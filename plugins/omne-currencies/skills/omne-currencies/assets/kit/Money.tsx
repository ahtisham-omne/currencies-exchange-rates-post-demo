import * as React from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { getBaseCurrency, getCurrency, isBaseCurrency } from './currencies';
import { formatCompactMoney, formatEstimate, formatMoney, formatMoneyWithCode, formatRateDate, rateSentence } from './moneyFormat';
import { RATE_TYPE_LABEL, toBase, type RateType } from './rates';
import { CurrencyFlag } from './CurrencyChip';
import { FX_ARROW_PADDING, FX_CARD_CLASS, FX_FLAG_PX, FxAlert, FxArrow, FxHead, FxInset, FxLine, FxLines, FxNote, FxRateType } from './FxCard';

/* ── OMNE currency kit: money with its rate ───────────────────────────
 * A foreign amount wears a dotted underline, and hovering it shows the
 * other face of the same amount, the rate, its type and its day. Base
 * amounts with nothing to convert are plain text.
 *
 * Two faces of the same amount:
 *  - BaseMoney: shown in the base currency, the record's own amount on
 *    hover. The default on listings, KPIs and detail pages.
 *  - Money: shown in its own (the partner's, the document's) currency, the
 *    base on hover.
 *  - EstimateMoney: "≈ ₨2,833,270.62", a base figure beside a real one, or
 *    a converted figure that isn't final.
 *  - KpiMoney: a KPI figure, compact and in base, no hover.
 * DocMoney (DocCurrency.tsx) picks the face from the page's switch.
 *
 * Shared file. Do not edit it in a module. */

/** A document's or record's rate to base. */
export interface MoneyFx {
  /** Base currency per one unit of the amount's currency. */
  rate: number;
  rateType: RateType;
  /** ISO day the rate is for. */
  rateDate: string;
  /** "Open Exchange Rates", "Set by Ahtisham Ahmad", "Corporate rate, changed on the PO". */
  source?: string;
  /** What the rate day is: "PO date", "posting date", "payment date". */
  dateLabel?: string;
  /** Not fixed yet (a document not saved or not posted): today's rate stands in. */
  provisional?: boolean;
}

/** "Nov 04, 2026 (posting date)", or "Today, Nov 18, 2026" for a rate not fixed yet. */
export function rateDayText(fx: MoneyFx, dateLabel?: string): string {
  return fx.provisional
    ? `Today, ${formatRateDate(fx.rateDate)}`
    : `${formatRateDate(fx.rateDate)} (${dateLabel ?? fx.dateLabel ?? 'document date'})`;
}

/** The hover for an amount shown in its own currency: that currency on top,
 *  then a grey block with the base figure and the rate. */
export function MoneyCard({ value, currency, fx, dateLabel, role }: { value: number; currency: string; fx: MoneyFx; dateLabel?: string; role?: string }) {
  const cur = getCurrency(currency);
  const base = getBaseCurrency();
  return (
    <>
      <FxHead flag={<CurrencyFlag code={currency} size={FX_FLAG_PX} />} name={cur?.name ?? currency} code={currency} role={role} />
      <FxLines>
        <FxLine label={`In ${currency}`} value={formatMoneyWithCode(value, currency)} />
      </FxLines>
      <FxInset>
        <FxLine strong label={`In ${base} (base)`} value={formatMoneyWithCode(toBase(value, fx.rate), base)} />
        <FxNote>At {rateSentence(currency, fx.rate)} · {rateDayText(fx, dateLabel)}</FxNote>
        <FxRateType type={fx.rateType} label={RATE_TYPE_LABEL[fx.rateType]} source={fx.source} />
        {fx.provisional && <FxAlert>Not posted yet. The rate is set when it posts.</FxAlert>}
      </FxInset>
    </>
  );
}

/** The hover for an amount shown in base: the base currency on top, the
 *  record's own amount, then the rate. */
export function BaseMoneyCard({ value, currency, fx, dateLabel, role = 'Document currency' }: { value: number; currency: string; fx: MoneyFx; dateLabel?: string; role?: string }) {
  const base = getBaseCurrency();
  return (
    <>
      <FxHead flag={<CurrencyFlag code={base} size={FX_FLAG_PX} />} name={getCurrency(base)?.name ?? base} code={base} role="base currency" />
      <FxLines>
        <FxLine strong label={`In ${base}`} value={formatMoneyWithCode(toBase(value, fx.rate), base)} />
        <FxLine label={role} value={formatMoneyWithCode(value, currency)} />
      </FxLines>
      <FxInset>
        <FxNote>At {rateSentence(currency, fx.rate)} · {rateDayText(fx, dateLabel)}</FxNote>
        <FxRateType type={fx.rateType} label={RATE_TYPE_LABEL[fx.rateType]} source={fx.source} />
        {fx.provisional && <FxAlert>Not posted yet. The rate is set when it posts.</FxAlert>}
      </FxInset>
    </>
  );
}

const TRIGGER_CLASS =
  'tabular-nums cursor-help underline decoration-dotted decoration-slate-300 underline-offset-[3px] hover:decoration-slate-500 focus-visible:outline-none focus-visible:decoration-primary';

/** The dotted trigger and the shared card around a hover body. */
export function FxHover({ text, className = '', children }: { text: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span tabIndex={0} onClick={(e) => e.stopPropagation()} className={`${TRIGGER_CLASS} ${className}`}>
          {text}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className={FX_CARD_CLASS} arrowPadding={FX_ARROW_PADDING} onClick={(e) => e.stopPropagation()}>
        {children}
        <FxArrow />
      </HoverCardContent>
    </HoverCard>
  );
}

interface FaceProps {
  /** The amount in `currency` (the record's own currency). */
  value: number;
  currency: string | null | undefined;
  /** The record's rate to base; leave out for a base amount. */
  fx?: MoneyFx | null;
  className?: string;
  dateLabel?: string;
  /** What `currency` is to the record: "Vendor currency", "Invoice currency". */
  role?: string;
  /** Replaces the rendered text (a highlighted or signed copy); the hover stays. */
  children?: React.ReactNode;
}

/** An amount kept in `currency`, shown in the base currency, its own amount on hover. */
export function BaseMoney({ value, currency, fx, className = '', dateLabel, role, children }: FaceProps) {
  const code = (currency || getBaseCurrency()).toUpperCase();
  if (!fx || isBaseCurrency(code)) return <span className={`tabular-nums ${className}`}>{children ?? formatMoney(value, code)}</span>;
  const text = children ?? formatMoney(toBase(value, fx.rate), getBaseCurrency());
  if (!value) return <span className={`tabular-nums ${className}`}>{text}</span>;
  return (
    <FxHover text={text} className={className}>
      <BaseMoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role} />
    </FxHover>
  );
}

/** An amount in its own currency, the base on hover. */
export function Money({ value, currency, fx, className = '', dateLabel, role, children }: FaceProps) {
  const code = (currency || getBaseCurrency()).toUpperCase();
  const text = children ?? formatMoney(value, code);
  if (!fx || isBaseCurrency(code) || !value) return <span className={`tabular-nums ${className}`}>{text}</span>;
  return (
    <FxHover text={text} className={className}>
      <MoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role ? role.charAt(0).toLowerCase() + role.slice(1) : undefined} />
    </FxHover>
  );
}

/**
 * "≈ ₨2,833,270.62": the base estimate of a foreign amount, muted, with the
 * rate on hover. Used for a separate base column beside a real amount
 * (vendor invoice listings), and for a converted figure that isn't final
 * (a payment from a third-currency account, a price with no regional price).
 */
export function EstimateMoney({ value, currency, fx, className = '', dateLabel, role }: Omit<FaceProps, 'children'>) {
  const code = (currency || getBaseCurrency()).toUpperCase();
  if (!fx || isBaseCurrency(code)) return <span className={`tabular-nums text-slate-500 ${className}`}>{formatMoney(value, code)}</span>;
  return (
    <FxHover text={formatEstimate(toBase(value, fx.rate), getBaseCurrency())} className={`text-slate-500 ${className}`}>
      <BaseMoneyCard value={value} currency={code} fx={fx} dateLabel={dateLabel} role={role} />
    </FxHover>
  );
}

/** A KPI figure: compact, always in the base currency, no hover. Convert
 *  the KPI's records to base (each at its own rate) before summing. */
export function KpiMoney({ valueInBase, className = '' }: { valueInBase: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatCompactMoney(valueInBase, getBaseCurrency())}</span>;
}
