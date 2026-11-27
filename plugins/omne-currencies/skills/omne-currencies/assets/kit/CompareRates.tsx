import { ArrowLeftRight } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { getBaseCurrency, getCurrency } from './currencies';
import { formatDayMonthYear, formatMoney, rateSentence } from './moneyFormat';
import { compareRatesOn, RATE_HEX, RATE_PROVIDER, todayIso, type RateType } from './rates';
import { linkProvider } from './ProviderLink';

/* ── OMNE currency kit: Compare rates ─────────────────────────────────
 * Nophil, 25 Nov 2026: the user can't compare mid-market and corporate
 * while choosing one on an order. An icon button right after the
 * RateTypeToggle (in the order's Currency configuration, and on the create
 * screen where the rate type is chosen there) opens a small read-only card
 * with both rates for the pair: the partner's currency against the base.
 *
 *   Rates for USD to PKR today
 *   ● Mid-market            1 USD = ₨278.5200 PKR
 *     Open Exchange Rates
 *   ● Corporate             1 USD = ₨281.5000 PKR   Selected
 *     Set by finance, effective 1 May 2026
 *   Corporate is ₨2.98 (1.07%) above mid-market.
 *
 * Works inside a dialog (the card sits above it). Changes nothing.
 *
 * Shared file. Do not edit it in a module. */

export function CompareRates({
  currency,
  rateDate,
  selected,
}: {
  /** The partner's (the document's) currency. */
  currency: string;
  /** The document's rate date; today when left out. */
  rateDate?: string;
  /** The rate type the document uses now. */
  selected: RateType;
}) {
  const base = getBaseCurrency();
  const today = todayIso();
  const day = (rateDate ?? today).slice(0, 10);
  const cmp = compareRatesOn(currency, day);
  if (!getCurrency(currency) || currency.toUpperCase() === base) return null;
  const when = day === today ? 'today' : `on ${formatDayMonthYear(day)}`;
  const corpSource =
    cmp.corporate.rate != null && cmp.corporate.effectiveDate
      ? `Set by finance, effective ${formatDayMonthYear(cmp.corporate.effectiveDate)}`
      : 'No corporate rate set';
  const rows: { type: RateType; label: string; rate: number | null; source: string }[] = [
    { type: 'mid', label: 'Mid-market', rate: cmp.mid.rate, source: RATE_PROVIDER },
    { type: 'corporate', label: 'Corporate', rate: cmp.corporate.rate, source: corpSource },
  ];
  const diff = cmp.difference;
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Compare rates"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-primary focus-visible:text-primary focus-visible:outline-none cursor-pointer shrink-0"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-[280px] p-3 bg-white rounded-lg border border-border shadow-lg text-[12px] z-[300]">
        <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
          Rates for {currency.toUpperCase()} to {base} {when}
        </p>
        <div className="mt-2 space-y-1">
          {rows.map((r) => {
            const isSelected = r.type === selected;
            return (
              <div key={r.type} className={`rounded-md px-2 py-1.5 ${isSelected ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RATE_HEX[r.type] }} />
                  <span className="text-slate-700 whitespace-nowrap" style={{ fontWeight: 500 }}>{r.label}</span>
                  <span className="ml-auto tabular-nums text-slate-700 whitespace-nowrap">
                    {r.rate != null ? rateSentence(currency, r.rate) : 'None'}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-3.5 text-[11px]">
                  <span className="text-slate-500 min-w-0">{linkProvider(r.source)}</span>
                  {isSelected && <span className="ml-auto text-slate-400 shrink-0">Selected</span>}
                </div>
              </div>
            );
          })}
        </div>
        {diff != null && cmp.percent != null && Math.abs(diff) > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Corporate is {formatMoney(Math.abs(diff), base)} ({Math.abs(cmp.percent).toFixed(2)}%) {diff > 0 ? 'above' : 'below'} mid-market.
          </p>
        )}
        {diff === 0 && <p className="mt-2 text-[11px] text-slate-500">Corporate is the same as mid-market.</p>}
      </HoverCardContent>
    </HoverCard>
  );
}
