import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency } from '@/app/currency/currencies';
import { CurrencyFlag } from './CurrencyChip';

/**
 * The label that says a band of figures is in the base currency. Item
 * prices and costs stay in base (spec 4.1); only a qualified vendor's
 * prices are in the vendor's currency.
 */
export function BaseCurrencyNote() {
  const name = getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border border-slate-200 bg-white text-[11px] text-slate-600 cursor-help whitespace-nowrap"
          style={{ fontWeight: 500 }}
        >
          <CurrencyFlag code={BASE_CURRENCY} />
          In {BASE_CURRENCY}
          <span className="text-slate-400">· base currency</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px] text-[11px]">
        Costs and prices on this item are in {name} ({BASE_CURRENCY}), the company's base currency. Purchases from a
        vendor in another currency are converted at the rate on their date.
      </TooltipContent>
    </Tooltip>
  );
}
