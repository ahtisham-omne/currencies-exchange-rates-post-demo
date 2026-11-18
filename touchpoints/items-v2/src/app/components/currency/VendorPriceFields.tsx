import * as React from 'react';
import { ArrowLeftRight, ArrowUpDown, Info, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { currencyDecimals, formatRate, formatRateDate } from '@/app/currency/money';
import { LAST_SYNC, RATE_PROVIDER, RATE_TYPE_LABEL, corporateRateOn, type RateType } from '@/app/currency/rates';
import { priceFromBase, priceInBase, pricePrefix, type VendorRate } from '@/app/currency/vendorFx';
import { CurrencyFlag } from './CurrencyChip';

/* ── Qualified-vendor prices in the Edit Vendors drawer (spec 4.1, 4.2, 3.5) ─
 * Laid out as the original Items file had its Price per UOM: the price in
 * base (PKR) and in the vendor's currency side by side, each filling the
 * other, and under them a "Current rate" box saying what links the two:
 * the rate, its type, its source and when it was set. The rate belongs to
 * the vendor, so the drawer shows the box once, above the selling units,
 * and every selling unit converts at it.
 *
 * The rate is today's mid-market rate (read-only) or, where finance has set
 * one for the currency, the corporate rate, chosen with the Mid-market |
 * Corporate switch the PO, the Exchange Rates module and the original file
 * use. A corporate rate can be typed for one vendor and reset to finance's.
 * Switching keeps the vendor's quote and restates the base price, since the
 * vendor charges in its own currency. */

const LABEL = 'flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5';
const BOX = 'flex items-stretch rounded-lg border overflow-hidden h-9 bg-white border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20';
const ADDON = 'inline-flex items-center justify-center min-w-9 px-1.5 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border shrink-0';
const INPUT = 'flex-1 min-w-0 px-2 text-[13px] tabular-nums outline-none bg-transparent';

/** Mid-market violet and corporate amber, as on the PO and in Exchange Rates. */
const RATE_TONE = {
  mid: { ink: '#6D28D9', dot: '#7C3AED', bg: '#F5F3FF', line: '#DDD6FE' },
  corporate: { ink: '#B45309', dot: '#B45309', bg: '#FFFBEB', line: '#FDE68A' },
} as const;

/** Side by side needs room for both fields and the vendor field's unit picker
 *  (about 130px); the drawer's narrower columns stack them. */
const SIDE_BY_SIDE_MIN = 460;

function useIsWide(ref: React.RefObject<HTMLElement>, min: number) {
  const [wide, setWide] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setWide(el.getBoundingClientRect().width >= min);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, min]);
  return wide;
}

/** "Apr 10, 2026, 7:30 PM": when the provider's rates were last synced. */
function syncedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** One selling unit's price: Base (PKR) ⇆ Vendor (its currency). The vendor
 *  price is what is stored; typing the base price fills it at the vendor's
 *  rate. The design's unit picker stays on the vendor price. */
export function VendorPriceFields({
  price,
  onPriceChange,
  fx,
  unit,
  uomPicker,
}: {
  /** The vendor-currency price as typed (a numeric string). */
  price: string;
  onPriceChange: (next: string) => void;
  fx: VendorRate;
  /** The selling unit's name, for the inputs' labels: "km (Kilometer)". */
  unit: string;
  /** The design's embedded unit-of-measure picker. */
  uomPicker?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const wide = useIsWide(ref, SIDE_BY_SIDE_MIN);
  const [baseDraft, setBaseDraft] = React.useState<string | null>(null);
  const n = Number(price);
  const base = price.trim() && Number.isFinite(n) ? priceInBase(n, fx.rate) : null;

  const vendorBox = (
    <div className={BOX}>
      <span className={ADDON} style={{ fontWeight: 500 }}>{pricePrefix(fx.currency)}</span>
      <input
        inputMode="decimal"
        aria-label={`Price per ${unit} in ${fx.currency}`}
        value={price}
        onChange={(e) => onPriceChange(e.target.value)}
        placeholder="0.00"
        className={INPUT}
      />
      {uomPicker}
    </div>
  );

  // A vendor in the base currency has one price; nothing converts.
  if (isBaseCurrency(fx.currency)) return vendorBox;

  const typeBase = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    setBaseDraft(clean);
    const b = Number(clean);
    onPriceChange(clean.trim() && Number.isFinite(b) ? priceFromBase(b, fx.rate, fx.currency).toFixed(currencyDecimals(fx.currency)) : '');
  };

  const baseField = (
    <div className="min-w-0 flex-1">
      <span className={LABEL} style={{ fontWeight: 500 }}>Base ({BASE_CURRENCY})</span>
      <div className={BOX}>
        <span className={ADDON} style={{ fontWeight: 500 }}>{pricePrefix(BASE_CURRENCY)}</span>
        <input
          inputMode="decimal"
          aria-label={`Price per ${unit} in ${BASE_CURRENCY}`}
          value={baseDraft ?? (base != null ? base.toFixed(2) : '')}
          onChange={(e) => typeBase(e.target.value)}
          onBlur={() => setBaseDraft(null)}
          placeholder="0.00"
          className={INPUT}
        />
      </div>
    </div>
  );

  const vendorField = (
    <div className={`min-w-0 ${wide ? 'flex-[1.6]' : ''}`}>
      <span className={LABEL} style={{ fontWeight: 500 }}>
        Vendor
        <span className="inline-flex items-center gap-1 text-slate-600" style={{ fontWeight: 600 }}>
          <CurrencyFlag code={fx.currency} size={10} />
          {fx.currency}
        </span>
      </span>
      {vendorBox}
    </div>
  );

  const link = (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className={`flex items-center justify-center text-slate-300 cursor-help shrink-0 ${wide ? 'h-9' : 'h-3.5'}`}>
          {wide ? (
            <ArrowLeftRight className="w-3.5 h-3.5" aria-label="Linked by the vendor's rate" />
          ) : (
            <ArrowUpDown className="w-3 h-3" aria-label="Linked by the vendor's rate" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-[11px]">
        Enter either price; the other is worked out at the vendor's current rate.
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div ref={ref}>
      {wide ? (
        <div className="flex items-end gap-1.5">
          {baseField}
          {link}
          {vendorField}
        </div>
      ) : (
        <div className="space-y-0.5">
          {baseField}
          {link}
          {vendorField}
        </div>
      )}
    </div>
  );
}

/** Mid-market | Corporate, as the Exchange Rates module names them. */
function RateTypeToggle({ value, onChange }: { value: RateType; onChange: (t: RateType) => void }) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white/70 p-px shrink-0" role="radiogroup" aria-label="Rate type">
      {(['mid', 'corporate'] as RateType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => value !== t && onChange(t)}
          className={`px-1.5 py-px rounded text-[10.5px] cursor-pointer transition-colors ${
            value === t ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-slate-500 hover:text-foreground'
          }`}
          style={{ fontWeight: value === t ? 600 : 500 }}
        >
          {RATE_TYPE_LABEL[t]}
        </button>
      ))}
    </span>
  );
}

/** The vendor's rate, once per vendor: "Current rate: 1 USD = 278.5200 PKR",
 *  its type and source, and when it was set. The switch shows only where
 *  finance has a corporate rate for the currency. */
export function VendorRateCard({
  fx,
  onRateTypeChange,
  onRateChange,
  tag,
}: {
  fx: VendorRate;
  onRateTypeChange: (next: RateType) => void;
  /** A corporate rate typed for the vendor; null puts finance's rate back. */
  onRateChange: (next: string | null) => void;
  /** The drawer's "Modified · Revert" tag, when the rate changed. */
  tag?: React.ReactNode;
}) {
  const [rateDraft, setRateDraft] = React.useState<string | null>(null);

  if (isBaseCurrency(fx.currency)) {
    return (
      <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-600" style={{ lineHeight: 1.5 }}>
        This vendor quotes in {BASE_CURRENCY}, the base currency, so its prices aren't converted.
      </div>
    );
  }

  const corporate = fx.rateType === 'corporate';
  const tone = RATE_TONE[fx.rateType];
  const finance = corporateRateOn(fx.currency, fx.rateDate);
  // Offered where finance has set a corporate rate; a vendor already on
  // corporate keeps the switch so it can go back.
  const canSwitch = !!finance || corporate;
  const noFinanceRate = corporate && !finance && !fx.edited;

  const commitRate = () => {
    if (rateDraft == null) return;
    const r = Number(rateDraft);
    setRateDraft(null);
    if (Number.isFinite(r) && r > 0 && r !== fx.rate) onRateChange(String(r));
  };

  const source = corporate
    ? fx.edited
      ? 'Entered for this vendor'
      : finance
        ? `Set by ${finance.setBy}${finance.note ? ` · ${finance.note}` : ''}`
        : `No corporate rate set for ${fx.currency}`
    : `Source: ${RATE_PROVIDER}`;
  const when = corporate
    ? fx.edited
      ? finance
        ? `Finance's rate is ${formatRate(finance.rate)} ${BASE_CURRENCY}, in effect since ${formatRateDate(finance.effectiveDate)}`
        : 'Typed for this vendor only'
      : finance
        ? `In effect since ${formatRateDate(finance.effectiveDate)}`
        : 'Mid-market shown until one is entered'
    : `Updated as of ${syncedAt(LAST_SYNC)}`;

  return (
    <div className="px-3 py-2.5 rounded-lg border transition-colors" style={{ backgroundColor: tone.bg, borderColor: tone.line }}>
      <div className="flex items-center justify-between gap-2 min-h-[20px]">
        <span className="flex items-center gap-1 flex-wrap text-[11px] text-slate-600 min-w-0" style={{ fontWeight: 500 }}>
          Current rate
          {tag}
        </span>
        {canSwitch ? (
          <RateTypeToggle value={fx.rateType} onChange={onRateTypeChange} />
        ) : (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-slate-400 cursor-help shrink-0" aria-label="About the rate" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px] max-w-[240px]">
              No corporate rate is set for {fx.currency}, so this vendor's prices convert at the mid-market rate. Finance sets
              corporate rates in Currency &amp; Exchange Rates.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-800 tabular-nums min-w-0">
        <CurrencyFlag code={fx.currency} />
        {corporate ? (
          <span className="inline-flex items-center gap-1 min-w-0" style={{ fontWeight: 600 }}>
            1 {fx.currency} =
            <input
              inputMode="decimal"
              aria-label={`Corporate rate, ${BASE_CURRENCY} per 1 ${fx.currency}`}
              value={rateDraft ?? formatRate(fx.rate).replace(/,/g, '')}
              onChange={(e) => setRateDraft(e.target.value.replace(/[^\d.]/g, ''))}
              onBlur={commitRate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRateDraft(null);
              }}
              className="w-[84px] h-6 px-1.5 rounded-md border border-amber-200 bg-white text-[12.5px] tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              style={{ fontWeight: 600 }}
            />
            {BASE_CURRENCY}
            {fx.edited && (
              <button
                type="button"
                onClick={() => onRateChange(null)}
                className="ml-0.5 p-0.5 rounded text-slate-400 hover:text-primary cursor-pointer"
                title={finance ? `Back to finance's corporate rate, ${formatRate(finance.rate)}` : 'Clear the typed rate'}
                aria-label={finance ? 'Reset to the corporate rate' : 'Clear the typed rate'}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </span>
        ) : (
          <span className="truncate" style={{ fontWeight: 600 }}>
            1 {fx.currency} = {formatRate(fx.rate)} {BASE_CURRENCY}
          </span>
        )}
      </div>

      <div className="text-[10.5px] text-slate-600 mt-1 flex items-center gap-1.5 min-w-0">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tone.dot }} />
        <span className="shrink-0" style={{ color: tone.ink, fontWeight: 600 }}>{RATE_TYPE_LABEL[fx.rateType]} rate</span>
        <span className={`truncate ${fx.edited || noFinanceRate ? 'text-amber-700' : 'text-slate-400'}`} title={source}>· {source}</span>
      </div>
      <div className="text-[10.5px] text-slate-500 mt-0.5" style={{ lineHeight: 1.45 }}>{when}</div>
      <div className="text-[10.5px] text-slate-500 mt-1.5 pt-1.5 border-t border-dashed" style={{ borderColor: tone.line, lineHeight: 1.45 }}>
        Every selling unit below converts at this rate.
      </div>
    </div>
  );
}

/** The vendor's currency in the drawer header (spec 4.1): flag + code,
 *  inherited from the partner. */
export function VendorCurrencyChip({ fx }: { fx: VendorRate }) {
  const name = getCurrency(fx.currency)?.name ?? fx.currency;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 px-2 py-px rounded-md text-[10px] border cursor-default"
          style={{ fontWeight: 600, backgroundColor: '#F8FAFC', color: '#334155', borderColor: '#E2E8F0' }}
        >
          <CurrencyFlag code={fx.currency} size={10} />
          {fx.currency}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-[11px]">
        {name}, inherited from the partner. This vendor's prices are entered in it; the price in {BASE_CURRENCY} is
        worked out at the vendor's current rate.
      </TooltipContent>
    </Tooltip>
  );
}
