import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { cn } from "./utils";
import { CurrencyFlag } from "./CurrencyFlag";
import {
  BASE_CURRENCY,
  getLibraryCurrency,
  type LibraryCurrency,
} from "@/app/data/currencyLibrary";

export type CurrencyAmountMode = "single" | "listing-base" | "aggregated-base";

export interface CurrencyAmountProps {
  /** Numeric value already expressed in `currency`. */
  value: number;
  /** ISO 4217 alpha-3 of the displayed value. Any case. */
  currency: string;
  /** Selects the hover-card content shape. */
  mode: CurrencyAmountMode;
  /** Required when `mode="listing-base"` — the partner's default currency for the hover line. */
  partnerDefaultCurrency?: string;
  /** Required when `mode="listing-base"` — the partner-currency raw amount to show in the hover. */
  partnerDefaultValue?: number;
  /** Required when `mode="aggregated-base"` — per-currency partner counts. */
  partnerBreakdown?: { code: string; partnerCount: number }[];
  /** Render negative values with a leading minus + space (default true when value < 0). */
  signed?: boolean;
  className?: string;
}

/**
 * Display a financial amount with a Currency-Library-style hover that explains
 * the currency context. The symbol gets a dotted underline + help cursor as a
 * discoverability cue. The hover is suppressed when it would add no info
 * (zero amounts, or a listing-base value where the partner default already
 * matches the base currency).
 */
export function CurrencyAmount(props: CurrencyAmountProps) {
  const { value, currency, mode, signed, className } = props;
  const c = getLibraryCurrency(currency) ?? getLibraryCurrency(BASE_CURRENCY)!;
  const showHover = shouldShowHover(props);

  const formatted = formatNumber(Math.abs(value), c.code);
  const sign = (signed ?? value < 0) && value < 0 ? "- " : "";
  const symbol = c.symbol ?? c.code;

  const body = (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      {sign}
      <span
        className={cn(
          "mr-1",
          showHover && "border-b border-dotted border-slate-400 leading-none pb-[1px]",
        )}
      >
        {symbol}
      </span>
      <span>{formatted}</span>
    </span>
  );

  if (!showHover) return body;

  const ariaLabel = `${c.name} (${c.code}) ${symbol} ${formatted}`;

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex items-baseline cursor-help bg-transparent p-0 m-0 border-0 text-left"
          style={{ font: "inherit", color: "inherit", letterSpacing: "inherit", lineHeight: "inherit" }}
        >
          {body}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-auto min-w-[260px] max-w-[320px] p-3 rounded-lg border border-slate-200 shadow-lg bg-white"
      >
        <TooltipBody {...props} currencyRecord={c} />
      </HoverCardContent>
    </HoverCard>
  );
}

function shouldShowHover(props: CurrencyAmountProps): boolean {
  if (props.value === 0) return false;
  if (props.mode === "listing-base") {
    const partner = props.partnerDefaultCurrency?.toUpperCase();
    return !!partner && partner !== BASE_CURRENCY;
  }
  if (props.mode === "single") {
    return props.currency.toUpperCase() !== BASE_CURRENCY;
  }
  // aggregated-base always reveals useful breakdown context.
  return true;
}

function HeaderLine({
  flag,
  name,
  code,
  tail,
}: {
  flag: React.ReactNode;
  name: string;
  code: string;
  tail?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 text-[13px] font-semibold text-slate-900">
      <span className="self-center">{flag}</span>
      <span>
        {name} ({code})
      </span>
      {tail && <span className="text-slate-500 font-normal">{tail}</span>}
    </div>
  );
}

function TooltipBody(props: CurrencyAmountProps & { currencyRecord: LibraryCurrency }) {
  const c = props.currencyRecord;
  const flag = <CurrencyFlag currency={c} size={18} />;

  if (props.mode === "listing-base") {
    const partner = getLibraryCurrency(props.partnerDefaultCurrency) ?? c;
    const partnerSymbol = partner.symbol ?? partner.code;
    return (
      <>
        <HeaderLine flag={flag} name={c.name} code={c.code} tail="— base currency" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700">
          Partner default: {partnerSymbol} {formatNumber(props.partnerDefaultValue ?? 0, partner.code)} {partner.code}
        </div>
        <div className="text-[11px] text-slate-400 mt-1.5">At today&apos;s mid-market rate</div>
      </>
    );
  }

  if (props.mode === "aggregated-base") {
    const rows = props.partnerBreakdown ?? [];
    const totalPartners = rows.reduce((acc, r) => acc + r.partnerCount, 0);
    return (
      <>
        <HeaderLine flag={flag} name={c.name} code={c.code} tail="— base currency" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-500 mb-1.5">
          Across {totalPartners} {totalPartners === 1 ? "partner" : "partners"} in {rows.length}{" "}
          {rows.length === 1 ? "currency" : "currencies"}
        </div>
        {rows.map((r) => (
          <div key={r.code} className="text-[12px] text-slate-700 leading-5">
            {r.code} · {r.partnerCount} {r.partnerCount === 1 ? "partner" : "partners"}
          </div>
        ))}
      </>
    );
  }

  // single
  return <HeaderLine flag={flag} name={c.name} code={c.code} />;
}

function formatNumber(value: number, code: string): string {
  // Zero-decimal currencies per ISO 4217.
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  // Three-decimal Gulf dinars + Tunisian Dinar.
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
