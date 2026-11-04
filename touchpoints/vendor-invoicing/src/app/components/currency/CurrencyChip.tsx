import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { BASE_CURRENCY, getCurrency } from '@/app/currency/currencies';
import { FlagImage } from './FlagImage';

/** A currency's flag, `size` px wide (the Currency & Exchange Rates module's 4:3 set). */
export function CurrencyFlag({ code, size = 16, className }: { code: string | null | undefined; size?: number; className?: string }) {
  const flag = getCurrency(code)?.flag ?? null;
  // FlagImage is 1.33em wide, so this font size makes it `size` px wide.
  return <FlagImage code={flag ?? (code ? code.slice(0, 2) : null)} className={className} style={{ fontSize: size * 0.75 }} />;
}

/** A small rounded pill (flag + code) for a record's currency, e.g. a vendor's
 *  default currency in a picker row. `note` explains where it comes from. */
export function CurrencyPill({ code, note }: { code: string; note?: string }) {
  const cur = getCurrency(code);
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] bg-white text-slate-600 border border-slate-200 cursor-default"
          style={{ fontWeight: 500 }}
        >
          <CurrencyFlag code={code} size={12} />
          {code.toUpperCase()}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span style={{ fontWeight: 600 }}>{cur?.name ?? code}</span>
        {note && <span className="block text-slate-500">{note}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Flag + ISO code, the way the module shows a currency in a cell or field;
 * the name rides a tooltip. The base currency is marked as such.
 */
export function CurrencyChip({
  code,
  size = 16,
  showName = false,
  className = '',
}: {
  code: string | null | undefined;
  size?: number;
  /** Write the name beside the code instead of only on hover. */
  showName?: boolean;
  className?: string;
}) {
  const cur = getCurrency(code);
  const label = (code || '').toUpperCase();
  if (!label) return null;
  const isBase = label === BASE_CURRENCY;
  const chip = (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      <CurrencyFlag code={label} size={size} />
      <span className="tabular-nums" style={{ fontWeight: 500 }}>{label}</span>
      {showName && cur && <span className="text-slate-500 truncate">{cur.name}</span>}
    </span>
  );
  if (showName && !isBase) return chip;
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="top">
        <span style={{ fontWeight: 600 }}>{cur?.name ?? label}</span>
        {isBase && <span className="text-slate-500"> · base currency</span>}
      </TooltipContent>
    </Tooltip>
  );
}
