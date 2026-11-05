import * as React from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency } from '@/app/currency/currencies';
import { currencyDecimals, formatRate } from '@/app/currency/money';
import { RATE_PROVIDER, RATE_TYPE_LABEL, type RateType } from '@/app/currency/rates';
import { priceFromBase, priceInBase, pricePrefix, type VendorRate } from '@/app/currency/vendorFx';
import { CurrencyFlag } from './CurrencyChip';

/* ── A selling unit's price in three fields (spec 4.1, 3.5) ───────────
 * 1) the price in the vendor's currency (the design's "Price per unit"
 * input, prefixed with the currency), 2) the exchange rate between the
 * vendor's currency and base, 3) the price in base. Entering either price
 * fills the other. The rate belongs to the vendor, so every selling unit
 * shows the same one: read-only on Mid-market, editable on Corporate. */

const LABEL = 'flex items-center gap-1 text-[10.5px] text-slate-500 mb-0.5';
const BOX = 'flex items-stretch rounded-lg border overflow-hidden h-9';
const ADDON = 'inline-flex items-center justify-center px-2 text-[12px] text-slate-400 bg-[#FAFBFC] shrink-0';

export function VendorPriceFields({
  price,
  onPriceChange,
  fx,
  onRateChange,
  rateTag,
}: {
  /** The vendor-currency price as typed (a numeric string). */
  price: string;
  onPriceChange: (next: string) => void;
  fx: VendorRate;
  /** A corporate rate typed for the vendor; null puts finance's rate back. */
  onRateChange: (next: string | null) => void;
  /** The drawer's "Modified · Revert" tag for the rate, when it changed. */
  rateTag?: React.ReactNode;
}) {
  const [baseDraft, setBaseDraft] = React.useState<string | null>(null);
  const [rateDraft, setRateDraft] = React.useState<string | null>(null);
  const n = Number(price);
  const base = Number.isFinite(n) && price.trim() ? priceInBase(n, fx.rate) : null;
  const corporate = fx.rateType === 'corporate';

  const typeBase = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, '');
    setBaseDraft(clean);
    const b = Number(clean);
    // Typing the base price fills the vendor price, at the vendor's rate.
    onPriceChange(clean.trim() && Number.isFinite(b) ? priceFromBase(b, fx.rate, fx.currency).toFixed(currencyDecimals(fx.currency)) : '');
  };

  const commitRate = () => {
    if (rateDraft == null) return;
    const r = Number(rateDraft);
    setRateDraft(null);
    if (Number.isFinite(r) && r > 0 && r !== fx.rate) onRateChange(String(r));
  };

  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <span className={LABEL} style={{ fontWeight: 500 }}>
          Exchange rate
          <span className="text-[9.5px]" style={{ fontWeight: 600, color: corporate ? '#B45309' : '#6D28D9' }}>
            {RATE_TYPE_LABEL[fx.rateType]}
          </span>
          {rateTag}
        </span>
        {corporate ? (
          <div className={`${BOX} border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-white`}>
            <span className={`${ADDON} border-r border-border whitespace-nowrap`}>1 {fx.currency} =</span>
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
              className="flex-1 min-w-0 px-2 text-[13px] tabular-nums outline-none bg-transparent"
            />
            <span className="inline-flex items-center pr-2 text-[12px] text-slate-400">{BASE_CURRENCY}</span>
            {fx.edited && (
              <button
                type="button"
                onClick={() => onRateChange(null)}
                className="px-1.5 text-slate-400 hover:text-primary cursor-pointer"
                title={
                  fx.corporateRate != null
                    ? `Back to the corporate rate, ${formatRate(fx.corporateRate)}`
                    : 'Clear the typed rate (no corporate rate is set, so mid-market shows)'
                }
                aria-label={fx.corporateRate != null ? 'Reset to the corporate rate' : 'Clear the typed rate'}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div className={`${BOX} border-slate-200 bg-slate-50 cursor-not-allowed`}>
                <span className={`${ADDON} border-r border-slate-200 whitespace-nowrap`}>1 {fx.currency} =</span>
                <span className="flex-1 min-w-0 px-2 flex items-center text-[13px] tabular-nums text-slate-700 truncate">{formatRate(fx.rate)}</span>
                <span className="inline-flex items-center gap-1.5 pr-2 text-[12px] text-slate-400">{BASE_CURRENCY}<Lock className="w-3 h-3 text-slate-300" /></span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-[11px]">
              1 {fx.currency} = {formatRate(fx.rate)} {BASE_CURRENCY}, today's mid-market rate from {RATE_PROVIDER}. Mid-market
              rates are read-only; switch the vendor to Corporate to use or change a corporate rate.
            </TooltipContent>
          </Tooltip>
        )}
        {(fx.edited || (corporate && fx.corporateRate == null)) && (
          <p className="mt-0.5 text-[10px] text-amber-700 truncate">
            {fx.edited ? 'Entered for this vendor' : `No corporate rate set for ${fx.currency}; enter one`}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <span className={LABEL} style={{ fontWeight: 500 }}>
          Price in {BASE_CURRENCY}
        </span>
        <div className={`${BOX} border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-white`}>
          <span className={`${ADDON} border-r border-border`} style={{ fontWeight: 500 }}>{pricePrefix(BASE_CURRENCY)}</span>
          <input
            inputMode="decimal"
            aria-label={`Price per unit in ${BASE_CURRENCY}`}
            value={baseDraft ?? (base != null ? base.toFixed(2) : '')}
            onChange={(e) => typeBase(e.target.value)}
            onBlur={() => setBaseDraft(null)}
            placeholder="0.00"
            className="flex-1 min-w-0 px-2 text-[13px] tabular-nums outline-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}

/** The vendor's currency in the drawer header (spec 4.1): flag + code,
 *  inherited from the partner, and the vendor's rate type. */
export function VendorCurrencyChip({
  fx,
  rateType,
  onRateTypeChange,
}: {
  fx: VendorRate;
  rateType: RateType;
  onRateTypeChange?: (next: RateType) => void;
}) {
  const name = getCurrency(fx.currency)?.name ?? fx.currency;
  return (
    <span className="inline-flex items-center gap-1.5">
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
          worked out at the exchange rate.
        </TooltipContent>
      </Tooltip>
      {onRateTypeChange && fx.currency !== BASE_CURRENCY && (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-px" role="radiogroup" aria-label="Rate type">
          {(['mid', 'corporate'] as RateType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={rateType === t}
              onClick={() => rateType !== t && onRateTypeChange(t)}
              className={`px-1.5 py-px rounded text-[10px] cursor-pointer transition-colors ${
                rateType === t ? 'bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-foreground'
              }`}
              style={{ fontWeight: rateType === t ? 600 : 500 }}
            >
              {RATE_TYPE_LABEL[t]}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
