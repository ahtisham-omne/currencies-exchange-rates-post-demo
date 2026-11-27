import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { RATE_PROVIDER, RATE_TYPE_LABEL, type RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyFlag";

/**
 * A record's currency as a small rounded tag (flag + code), the same pill the
 * Purchase Orders and Vendor Invoicing touchpoints put after a vendor's name.
 * The name, and where the currency comes from, ride the tooltip.
 */
/** The chip's hover, one line (25 Nov 2026): "Partner's currency: US Dollar (USD)". */
export function currencyChipLabel(code: string, party = "Partner"): string {
  const upper = code.toUpperCase();
  const name = upper === "USD" ? "US Dollar" : getCurrency(upper)?.name ?? upper;
  return `${party}'s currency: ${name} (${upper})`;
}

export function CurrencyPill({ code, note: _note, party, className = "" }: { code: string; note?: string; party?: string; className?: string }) {
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
        {currencyChipLabel(upper, party)}
      </TooltipContent>
    </Tooltip>
  );
}

/** What each rate type means, on hover of its option. */
const RATE_TYPE_TIP: Record<RateType, string> = {
  // The daily meaning (Eli's ruling, 26 Nov 2026).
  mid: `Read once a day from ${RATE_PROVIDER}, and fixed for that date.`,
  corporate: "Fixed rate set by your company. Applies until a new rate takes effect.",
};

/**
 * Daily market rate | Corporate rate, the switch the document touchpoints use for a rate
 * type. Drawn frameless like Chart of Accounts' period presets: the chosen
 * option is a light-blue pill. `disabled` keeps it readable but fixed.
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
    <span className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5 shrink-0" role="radiogroup" aria-label="Default exchange rate">
      {(["mid", "corporate"] as RateType[]).map((t) => {
        const active = value === t;
        return (
          <Tooltip key={t} delayDuration={250}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (value !== t) onChange(t);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                  active ? "bg-[#EDF4FF] text-[#0A77FF]" : disabled ? "text-muted-foreground" : "text-muted-foreground hover:bg-muted"
                } ${disabled ? (active ? "cursor-default" : "opacity-50 cursor-not-allowed") : "cursor-pointer"}`}
                style={{ fontWeight: active ? 500 : 400 }}
              >
                {RATE_TYPE_LABEL[t]}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">{RATE_TYPE_TIP[t]}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
