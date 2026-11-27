import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { getCurrency, isBaseCurrency } from './currencies';
import { FlagImage } from './FlagImage';

/* ── OMNE currency kit: flags, chips and tags ─────────────────────────
 *  - CurrencyFlag: a currency's flag, `size` px wide.
 *  - CurrencyPill: the currency tag after a foreign partner's or document's
 *    name ("Rivian Automotive [🇺🇸 USD]"). A base-currency record gets none.
 *  - CurrencyChip: flag + code in a field or cell, the name on hover.
 *
 * Shared file. Do not edit it in a module. */

/** Who the currency belongs to, for the tag's hover. */
export type CurrencyParty = 'Vendor' | 'Customer' | 'Partner' | 'Account' | 'Invoice' | 'Payment';

/** A currency's flag, `size` px wide (the Currency & Exchange Rates module's 4:3 set). */
export function CurrencyFlag({ code, size = 16, className }: { code: string | null | undefined; size?: number; className?: string }) {
  const flag = getCurrency(code)?.flag ?? null;
  // FlagImage is 1.33em wide, so this font size makes it `size` px wide.
  return <FlagImage code={flag ?? (code ? code.slice(0, 2) : null)} className={className} style={{ fontSize: size * 0.75 }} />;
}

/** The tag's hover, one line (25 Nov 2026): "Vendor's currency: US Dollar (USD)". */
export function currencyChipLabel(code: string, party: CurrencyParty = 'Vendor'): string {
  const upper = code.toUpperCase();
  const name = upper === 'USD' ? 'US Dollar' : getCurrency(upper)?.name ?? upper;
  return `${party}'s currency: ${name} (${upper})`;
}

/**
 * The currency tag: a small rounded pill (flag + code) after a foreign
 * partner's or document's name. Renders nothing for the base currency, so it
 * can be dropped after every name.
 */
export function CurrencyPill({ code, party = 'Vendor', showBase = false }: { code: string | null | undefined; party?: CurrencyParty; showBase?: boolean }) {
  if (!code) return null;
  if (isBaseCurrency(code) && !showBase) return null;
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] bg-white text-slate-600 border border-slate-200 cursor-default shrink-0"
          style={{ fontWeight: 500 }}
        >
          <CurrencyFlag code={code} size={12} />
          {code.toUpperCase()}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{currencyChipLabel(code, party)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Flag + ISO code, the way the module shows a currency in a field; the name
 * rides a tooltip. The base currency is marked as such.
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
  const isBase = isBaseCurrency(label);
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
