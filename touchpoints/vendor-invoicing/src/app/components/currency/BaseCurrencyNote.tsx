import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency } from '@/app/currency/currencies';
import { CurrencyFlag } from './CurrencyChip';

/**
 * The label that says a band of figures is in the base currency (spec 4.4:
 * KPIs are converted to base and labelled). Each document is converted at
 * its own rate before the figures are added up.
 */
export function BaseCurrencyNote({ what = 'invoice' }: { what?: string }) {
  const name = getCurrency(BASE_CURRENCY)?.name ?? BASE_CURRENCY;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border border-slate-200 bg-white text-[11px] text-slate-600 cursor-help whitespace-nowrap"
          style={{ fontWeight: 500 }}
        >
          <CurrencyFlag code={BASE_CURRENCY} size={14} />
          In {BASE_CURRENCY}
          <span className="text-slate-400">· base currency</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px]">
        Amounts on these cards are in {name} ({BASE_CURRENCY}), the company's base currency. Each {what} is converted at
        its own rate, the one on its posting date, before they are added up.
      </TooltipContent>
    </Tooltip>
  );
}
