import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { RATE_TYPE_LABEL, type RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyFlag";

/**
 * A record's currency as a small rounded tag (flag + code), the same pill the
 * Purchase Orders and Vendor Invoicing touchpoints put after a vendor's name.
 * The name, and where the currency comes from, ride the tooltip.
 */
export function CurrencyPill({ code, note, className = "" }: { code: string; note?: string; className?: string }) {
  const cur = getCurrency(code);
  const upper = code.toUpperCase();
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] leading-[16px] bg-white text-slate-600 border border-slate-200 cursor-default shrink-0 whitespace-nowrap ${className}`}
          style={{ fontWeight: 500 }}
        >
          <CurrencyFlag code={upper} className="text-[10px]" />
          {upper}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[300]">
        <span style={{ fontWeight: 600 }}>{cur?.name ?? upper}</span>
        {isBaseCurrency(upper) && <span className="text-slate-500"> · base currency</span>}
        {note && <span className="block text-slate-500">{note}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Mid-market | Corporate, the segmented switch the document touchpoints use
 * for a rate type. `disabled` keeps it readable but fixed.
 */
export function RateTypeToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: RateType;
  onChange: (type: RateType) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-px shrink-0" role="radiogroup" aria-label="Default exchange rate">
      {(["mid", "corporate"] as RateType[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (value !== t) onChange(t);
          }}
          className={`px-2 py-0.5 rounded text-[10.5px] transition-colors ${
            value === t ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-slate-500 hover:text-foreground"
          } ${disabled ? "cursor-default" : "cursor-pointer"}`}
          style={{ fontWeight: value === t ? 600 : 500 }}
        >
          {RATE_TYPE_LABEL[t]}
        </button>
      ))}
    </span>
  );
}
