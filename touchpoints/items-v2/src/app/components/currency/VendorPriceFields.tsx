import * as React from 'react';
import { ArrowLeftRight, ArrowUpDown, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from '@/app/currency/currencies';
import { currencyDecimals, formatRate, formatRateDate, rateSentence } from '@/app/currency/money';
import { LAST_SYNC, RATE_PROVIDER, RATE_TYPE_LABEL, corporateRateOn, type RateType } from '@/app/currency/rates';
import { priceFromBase, priceInBase, pricePrefix, type VendorRate } from '@/app/currency/vendorFx';
import { CurrencyFlag, currencyChipLabel } from './CurrencyChip';
import { linkProvider } from './ProviderLink';

/* ── Qualified-vendor prices in the Edit Vendors drawer ───────────────
 * Currency Touchpoints Map, Items 1 (24 Nov 2026), on the earlier spec 4.1,
 * 4.2 and 3.5 work: "Price per unit" has the base-currency box first
 * (₨ … PKR), then ⇄, then the vendor-currency box (€ … EUR). Typing in
 * either fills the other at the vendor's rate. Under the first selling
 * unit's price sit the Mid-market | Corporate switch and the rate it
 * converts at: "1 EUR = 304.8150 PKR · Open Exchange Rates, updated …".
 * The rate belongs to the vendor, so every selling unit converts at it; the
 * other units repeat it in one line.
 *
 * The rate is today's mid-market rate (read-only) or, where finance has set
 * one for the currency, the corporate rate, which can be typed for one
 * vendor and reset to finance's. Switching keeps the vendor's quote and
 * restates the base price, since the vendor charges in its own currency.
 * What is stored is unchanged: the vendor-currency price, the rate type and
 * a typed rate (`pricePerUnit`, `rateType`, `exchangeRate`). */

const LABEL = 'flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5';
const BOX = 'flex items-stretch rounded-lg border overflow-hidden h-9 bg-white border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20';
const ADDON = 'inline-flex items-center justify-center min-w-9 px-1.5 text-[12px] text-slate-400 bg-[#FAFBFC] border-r border-border shrink-0';
const INPUT = 'flex-1 min-w-0 px-2 text-[13px] tabular-nums outline-none bg-transparent';
const CODE = 'inline-flex items-center pr-2.5 text-[11px] text-slate-400 shrink-0 tabular-nums';

/** Mid-market violet and corporate amber, as on the PO and in Exchange Rates. */
const RATE_TONE = {
  mid: { ink: '#6D28D9', dot: '#7C3AED' },
  corporate: { ink: '#B45309', dot: '#B45309' },
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

/** One selling unit's price: Base currency ⇄ Vendor currency. The vendor
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
      <span className={CODE} style={{ fontWeight: 500 }}>{fx.currency}</span>
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
      <span className={LABEL} style={{ fontWeight: 500 }}>Base currency</span>
      <div className={BOX}>
        <span className={ADDON} style={{ fontWeight: 500 }}>{pricePrefix(BASE_CURRENCY)}</span>
        <input
          inputMode="decimal"
          aria-label={`Price per ${unit} in ${BASE_CURRENCY}, the base currency`}
          value={baseDraft ?? (base != null ? base.toFixed(2) : '')}
          onChange={(e) => typeBase(e.target.value)}
          onBlur={() => setBaseDraft(null)}
          placeholder="0.00"
          className={INPUT}
        />
        <span className={CODE} style={{ fontWeight: 500 }}>{BASE_CURRENCY}</span>
      </div>
    </div>
  );

  const vendorField = (
    <div className={`min-w-0 ${wide ? 'flex-[1.6]' : ''}`}>
      <span className={LABEL} style={{ fontWeight: 500 }}>Vendor currency</span>
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
        Enter the price in either currency. The other converts using the exchange rate.
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

/** Mid-market | Corporate, as the Exchange Rates module names them, drawn
 *  frameless like Chart of Accounts' period presets (the chosen option is a
 *  light-blue pill). With `corporateDisabled` (the reason), Corporate shows
 *  but can't be picked and the reason rides a tooltip. */
function RateTypeToggle({
  value,
  onChange,
  corporateDisabled,
}: {
  value: RateType;
  onChange: (t: RateType) => void;
  corporateDisabled?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0" role="radiogroup" aria-label="Rate type">
      {(['mid', 'corporate'] as RateType[]).map((t) => {
        const disabled = t === 'corporate' && !!corporateDisabled;
        const button = (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            disabled={disabled}
            onClick={() => !disabled && value !== t && onChange(t)}
            className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
              disabled
                ? 'text-muted-foreground opacity-50 cursor-not-allowed'
                : value === t
                  ? 'bg-[#EDF4FF] text-[#0A77FF] cursor-pointer'
                  : 'text-muted-foreground hover:bg-muted cursor-pointer'
            }`}
            style={{ fontWeight: value === t ? 500 : 400 }}
          >
            {RATE_TYPE_LABEL[t]}
          </button>
        );
        if (!disabled) return button;
        // A disabled button gets no pointer events, so the tooltip hangs on a wrapper.
        return (
          <Tooltip key={t} delayDuration={200}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex cursor-not-allowed">
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px] max-w-[240px]">
              {corporateDisabled}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

/** The vendor's rate, under the first selling unit's price: the Mid-market |
 *  Corporate switch, then "1 EUR = 304.8150 PKR · Open Exchange Rates,
 *  updated Apr 10, 2026, 7:30 PM". The switch always shows for a foreign
 *  vendor; Corporate is disabled until finance sets a corporate rate for the
 *  currency. The corporate rate is finance's and read-only here (it's set in
 *  Currency Library & Exchange Rates); a rate typed for a vendor earlier
 *  can still be put back to finance's. */
export function VendorRateCard({
  fx,
  onRateTypeChange,
  onRateChange,
  tag,
  unitCount = 1,
}: {
  fx: VendorRate;
  onRateTypeChange: (next: RateType) => void;
  /** A corporate rate typed for the vendor; null puts finance's rate back. */
  onRateChange: (next: string | null) => void;
  /** The drawer's "Modified · Revert" tag, when the rate changed. */
  tag?: React.ReactNode;
  /** How many selling units the vendor has; with more than one, says they all convert at this rate. */
  unitCount?: number;
}) {
  if (isBaseCurrency(fx.currency)) {
    return (
      <p className="mt-1.5 text-[10.5px] text-slate-500" style={{ lineHeight: 1.45 }}>
        This vendor quotes in {BASE_CURRENCY}, the base currency, so its prices aren't converted.
      </p>
    );
  }

  const corporate = fx.rateType === 'corporate';
  const tone = RATE_TONE[fx.rateType];
  const finance = corporateRateOn(fx.currency, fx.rateDate);
  // Corporate can be picked only where finance has set a corporate rate for
  // the currency; without one the price stays on mid-market (vendorRate).
  const canSwitch = !!finance;

  // Where the rate comes from and when, after the rate itself.
  const source = corporate
    ? fx.edited
      ? `Entered for this vendor${finance ? `. Finance's rate is ${formatRate(finance.rate)} ${BASE_CURRENCY}` : ''}`
      : `Corporate rate set by ${finance?.setBy ?? 'finance'}${finance ? `, in effect since ${formatRateDate(finance.effectiveDate)}` : ''}`
    : `${RATE_PROVIDER}, updated ${syncedAt(LAST_SYNC)}`;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap min-h-[20px]">
        <RateTypeToggle
          value={fx.rateType}
          onChange={onRateTypeChange}
          corporateDisabled={
            canSwitch
              ? undefined
              : `No corporate rate set for ${fx.currency}. Finance sets corporate rates in Currency Library & Exchange Rates.`
          }
        />
        {tag}
      </div>

      <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap text-[11px] text-slate-500 tabular-nums min-w-0" style={{ lineHeight: 1.45 }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tone.dot }} aria-hidden />
        {corporate ? (
          <span className="inline-flex items-center gap-1 text-slate-700" style={{ fontWeight: 600 }}>
            {/* Finance's rate, read-only: corporate rates are set in Currency
                Library & Exchange Rates, not per vendor. */}
            <span className="whitespace-nowrap">{rateSentence(fx.currency, fx.rate)}</span>
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
          <span className="text-slate-700 whitespace-nowrap" style={{ fontWeight: 600 }}>
            {rateSentence(fx.currency, fx.rate)}
          </span>
        )}
        {/* Wraps rather than truncates, so the provider's link stays whole in
            the drawer's narrow column. */}
        <span className={`min-w-0 ${fx.edited ? 'text-amber-700' : ''}`} title={corporate && finance?.note ? finance.note : undefined}>
          · {linkProvider(source)}
        </span>
      </div>
      {unitCount > 1 && (
        <p className="text-[10.5px] text-slate-400" style={{ lineHeight: 1.45 }}>
          Every selling unit converts at this rate.
        </p>
      )}
    </div>
  );
}

/** Under a further selling unit's price: the vendor's one rate, read-only. */
export function VendorUnitRateNote({ fx }: { fx: VendorRate }) {
  if (isBaseCurrency(fx.currency)) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-slate-400 tabular-nums" style={{ lineHeight: 1.45 }}>
      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: RATE_TONE[fx.rateType].dot }} aria-hidden />
      Converts at {rateSentence(fx.currency, fx.rate)} · {RATE_TYPE_LABEL[fx.rateType]}, the vendor's rate
    </p>
  );
}

/* "Sells in euros": the vendor's currency in words, for the drawer header.
   The vendors' currencies come from their countries (vendorFx
   COUNTRY_CURRENCY); any other falls back to the currency's name. */
const SELLS_IN: Record<string, string> = {
  USD: 'US dollars',
  EUR: 'euros',
  GBP: 'pounds sterling',
  JPY: 'yen',
  CNY: 'renminbi',
  CAD: 'Canadian dollars',
  AUD: 'Australian dollars',
  KRW: 'won',
  MXN: 'Mexican pesos',
  INR: 'Indian rupees',
  AED: 'UAE dirhams',
  SAR: 'Saudi riyals',
  CHF: 'Swiss francs',
};

/** The vendor's currency tag in the drawer header: flag + code and "Sells in
 *  euros", inherited from the partner. A vendor in the base currency gets no
 *  tag (Currency Touchpoints Map, Items 1). */
export function VendorCurrencyChip({ fx }: { fx: VendorRate }) {
  if (isBaseCurrency(fx.currency)) return null;
  const name = getCurrency(fx.currency)?.name ?? fx.currency;
  return (
    <>
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
          {currencyChipLabel(fx.currency)}
        </TooltipContent>
      </Tooltip>
      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
        Sells in {SELLS_IN[fx.currency] ?? name}
      </span>
    </>
  );
}
