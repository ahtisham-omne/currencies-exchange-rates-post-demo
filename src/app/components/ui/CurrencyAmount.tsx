import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { cn } from "./utils";
import { CurrencyFlag } from "../currency/CurrencyFlag";
import {
  BASE_CURRENCY,
  activeRateSnapshot,
  convertBetween,
  getLibraryCurrency,
  rateToBase,
  rateTypeLabel,
  type LibraryCurrency,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import { useRateContext } from "@/app/context/RateContext";

export type CurrencyAmountMode = "single" | "listing-base" | "listing-partner" | "aggregated-base" | "partner-rolled-up";

/** Per-currency transaction stream for a multi-currency partner. */
export interface PartnerBreakdownEntry {
  code: string;
  txCount: number;
  amount: number;
}

export interface CurrencyAmountProps {
  value: number;
  currency: string;
  mode: CurrencyAmountMode;
  /** Required when `mode="listing-base"` — the partner's default currency for the hover line. */
  partnerDefaultCurrency?: string;
  /** Required when `mode="listing-base"` — the partner-currency raw amount to show in the hover. */
  partnerDefaultValue?: number;
  /** Required when `mode="aggregated-base"` — per-currency partner counts. */
  partnerBreakdown?: { code: string; partnerCount: number }[];
  /** Required when `mode="partner-rolled-up"` — per-currency transaction streams. */
  rollupBreakdown?: PartnerBreakdownEntry[];
  /** Optional rate override — when supplied, the hover's rate line uses this instead of the live active snapshot. Use for sales-order line items that carry a locked rate captured at order-creation time. */
  lockedRate?: number;
  /** Optional ISO timestamp for when `lockedRate` was captured. Rendered in the hover when present. */
  lockedAt?: string;
  signed?: boolean;
  className?: string;
}

/**
 * Display a financial amount with a Currency-Library-style hover that explains
 * the currency context. Symbol gets a dotted underline + help cursor.
 */
export function CurrencyAmount(props: CurrencyAmountProps) {
  const { value, currency, mode, signed, className } = props;
  useRateContext();
  const c = getLibraryCurrency(currency) ?? getLibraryCurrency(BASE_CURRENCY)!;
  const showHover = shouldShowHover(props);

  const formatted = formatNumber(Math.abs(value), c.code);
  const sign = (signed ?? value < 0) && value < 0 ? "- " : "";
  const symbol = c.symbol ?? c.code;

  const body = (
    <span className={cn("inline-flex items-baseline whitespace-nowrap tabular-nums", className)}>
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
        className={cn(
          "rounded-lg border border-slate-200 shadow-lg bg-white",
          props.mode === "aggregated-base"
            ? "w-[280px] p-0 overflow-hidden"
            : "w-auto min-w-[260px] max-w-[320px] p-3",
        )}
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
  if (props.mode === "listing-partner") {
    return props.currency.toUpperCase() !== BASE_CURRENCY;
  }
  if (props.mode === "single") {
    return props.currency.toUpperCase() !== BASE_CURRENCY;
  }
  if (props.mode === "partner-rolled-up") {
    return (props.rollupBreakdown?.length ?? 0) > 1;
  }
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

function RateLine({
  partnerCode,
  lockedRate,
  lockedAt,
}: {
  partnerCode: string;
  lockedRate?: number;
  lockedAt?: string;
}) {
  const snap = activeRateSnapshot();
  const rate = lockedRate ?? rateToBase(partnerCode);
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;
  const locked = lockedRate !== undefined;
  const typeLabelText = rateTypeLabel(snap.type);
  const hex = snap.type === "market" ? "#7c3aed" : "#d97706";
  const sameAsBase = partnerCode.toUpperCase() === BASE_CURRENCY;
  const updatedAs = formatRateUpdatedAs(locked ? lockedAt : snap.lastSyncAt);
  const rateLabel = locked ? "Order reference rate" : "Current rate";
  return (
    <div className="mt-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
      {!sameAsBase && (
        <div className="text-[11px] text-slate-700 tabular-nums leading-4">
          <span className="text-slate-500" style={{ fontWeight: 500 }}>{rateLabel}: </span>
          1 {partnerCode.toUpperCase()} = {baseSym} {formatNumber(rate, BASE_CURRENCY)} {BASE_CURRENCY}
        </div>
      )}
      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
        <span style={{ color: hex, fontWeight: 600 }}>{typeLabelText}</span>
        <span className="text-slate-400">· Source: {snap.source}</span>
      </div>
      {updatedAs && (
        <div className="text-[10px] text-slate-400 mt-0.5">Updated as of {updatedAs}</div>
      )}
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
          Customer currency: {partnerSymbol} {formatNumber(props.partnerDefaultValue ?? 0, partner.code)} {partner.code}
        </div>
        <RateLine partnerCode={partner.code} lockedRate={props.lockedRate} lockedAt={props.lockedAt} />
      </>
    );
  }

  if (props.mode === "listing-partner") {
    const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
    const baseSymbol = baseCur.symbol ?? baseCur.code;
    const baseValue = props.lockedRate !== undefined
      ? props.value * props.lockedRate
      : convertBetween(props.value, c.code, BASE_CURRENCY);
    return (
      <>
        <HeaderLine flag={flag} name={c.name} code={c.code} tail="— customer currency" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700">
          Base equivalent: {baseSymbol} {formatNumber(baseValue, BASE_CURRENCY)} {baseCur.code}
        </div>
        <RateLine partnerCode={c.code} lockedRate={props.lockedRate} lockedAt={props.lockedAt} />
      </>
    );
  }

  if (props.mode === "partner-rolled-up") {
    const rows = props.rollupBreakdown ?? [];
    const partnerSym = c.symbol ?? c.code;
    const snap = activeRateSnapshot();
    const typeLabel = snap.type === "market" ? "Market" : "Corporate";
    return (
      <>
        <HeaderLine flag={flag} name={c.name} code={c.code} tail="— rolled up" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-500 mb-1.5">
          Aggregated across {rows.length} {rows.length === 1 ? "currency" : "currencies"}
        </div>
        {rows.map((r) => {
          const inPartner = convertBetween(r.amount, r.code, c.code);
          const sameAsPartner = r.code.toUpperCase() === c.code.toUpperCase();
          return (
            <div key={r.code} className="text-[12px] text-slate-700 leading-5">
              {r.code.toUpperCase()} · {r.txCount} transactions · {sameAsPartner ? "" : "≈ "}
              {partnerSym} {formatNumber(inPartner, c.code)}
            </div>
          );
        })}
        <div className="text-[10px] text-slate-400 mt-1.5">
          Converted via {typeLabel.toLowerCase()} rates · {snap.source}
        </div>
      </>
    );
  }

  // single
  return <HeaderLine flag={flag} name={c.name} code={c.code} />;
}

function formatNumber(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
