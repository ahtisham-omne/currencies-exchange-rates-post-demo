import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { cn } from "./utils";
import { CurrencyFlag } from "./CurrencyFlag";
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

export type CurrencyAmountMode = "single" | "listing-base" | "listing-partner" | "aggregated-base" | "partner-rolled-up";

/** Per-currency transaction stream for a multi-currency partner. */
export interface PartnerBreakdownEntry {
  /** ISO 4217 alpha-3 of the foreign currency. */
  code: string;
  /** Number of transactions in this currency. */
  txCount: number;
  /** Total amount in this currency. */
  amount: number;
}

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
  /** Required when `mode="partner-rolled-up"` — per-currency transaction streams. */
  rollupBreakdown?: PartnerBreakdownEntry[];
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
  const { value, currency, signed, className } = props;
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
    // No useful conversion to reveal when the partner already uses the base currency.
    return props.currency.toUpperCase() !== BASE_CURRENCY;
  }
  if (props.mode === "single") {
    return props.currency.toUpperCase() !== BASE_CURRENCY;
  }
  if (props.mode === "partner-rolled-up") {
    // Always useful — the breakdown is the whole point of this mode.
    return (props.rollupBreakdown?.length ?? 0) > 1;
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

function RateLine({ partnerCode }: { partnerCode: string }) {
  const snap = activeRateSnapshot();
  const rate = rateToBase(partnerCode);
  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;
  const sameAsBase = partnerCode.toUpperCase() === BASE_CURRENCY;
  const typeLabelText = rateTypeLabel(snap.type);
  const typeHex = snap.type === "market" ? "#7c3aed" : "#d97706";
  const updatedAs = formatRateUpdatedAs(snap.lastSyncAt);
  return (
    <div className="mt-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
      {!sameAsBase && (
        <div className="text-[11px] text-slate-700 tabular-nums leading-4">
          <span className="text-slate-500" style={{ fontWeight: 500 }}>Current rate: </span>
          1 {partnerCode.toUpperCase()} = {baseSym} {formatNumber(rate, BASE_CURRENCY)} {BASE_CURRENCY}
        </div>
      )}
      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeHex }} />
        <span style={{ color: typeHex, fontWeight: 600 }}>{typeLabelText}</span>
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
          Partner currency: {partnerSymbol} {formatNumber(props.partnerDefaultValue ?? 0, partner.code)} {partner.code}
        </div>
        <RateLine partnerCode={partner.code} />
      </>
    );
  }

  if (props.mode === "listing-partner") {
    const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
    const baseSymbol = baseCur.symbol ?? baseCur.code;
    const baseValue = convertBetween(props.value, c.code, BASE_CURRENCY);
    return (
      <>
        <HeaderLine flag={flag} name={c.name} code={c.code} tail="— partner currency" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700">
          Base equivalent: {baseSymbol} {formatNumber(baseValue, BASE_CURRENCY)} {baseCur.code}
        </div>
        <RateLine partnerCode={c.code} />
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

  if (props.mode === "aggregated-base") {
    // Pin the base-currency row at the top, then sort the rest by partner count.
    const raw = [...(props.partnerBreakdown ?? [])];
    const baseRow = raw.find((r) => r.code.toUpperCase() === BASE_CURRENCY);
    const otherRows = raw
      .filter((r) => r.code.toUpperCase() !== BASE_CURRENCY)
      .sort((a, b) => b.partnerCount - a.partnerCount);
    const rows = baseRow ? [baseRow, ...otherRows] : otherRows;
    const totalPartners = rows.reduce((acc, r) => acc + r.partnerCount, 0);
    const scrollable = rows.length > 5;
    const baseCur = getLibraryCurrency(BASE_CURRENCY);
    const baseSym = baseCur?.symbol ?? BASE_CURRENCY;
    const aggSnap = activeRateSnapshot();
    const aggTypeHex = aggSnap.type === "market" ? "#7c3aed" : "#d97706";
    const aggTypeLabel = rateTypeLabel(aggSnap.type);
    return (
      <div className="w-full">
        {/* Header — category label + count, styled like OverflowTooltip */}
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground/70" style={{ fontWeight: 600 }}>Currencies</span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{rows.length}</span>
        </div>
        {/* Rows — flag + code / full name + partner count */}
        <div
          className={cn("px-1.5 pb-1.5", scrollable && "overflow-y-auto overscroll-contain")}
          style={{ maxHeight: scrollable ? 5 * 44 : undefined }}
          // Radix Dialog's scroll-lock (react-remove-scroll) blocks wheel events
          // on portaled popovers; translate them manually so the flag list still
          // scrolls when the Add-Insights modal is open.
          onWheelCapture={scrollable ? (e) => {
            const el = e.currentTarget;
            if (el.scrollHeight <= el.clientHeight) return;
            el.scrollTop += e.deltaY;
            e.preventDefault();
            e.stopPropagation();
          } : undefined}
        >
          {rows.map((r) => {
            const cur = getLibraryCurrency(r.code);
            const name = cur?.name ?? r.code;
            const isBase = r.code.toUpperCase() === BASE_CURRENCY;
            return (
              <div
                key={r.code}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md",
                  isBase && "bg-primary/5 ring-1 ring-inset ring-primary/15",
                )}
              >
                <div
                  className={cn(
                    "shrink-0 w-7 h-7 rounded-md overflow-hidden border flex items-center justify-center",
                    isBase ? "bg-white border-primary/25" : "bg-muted border-[#E8ECF1]",
                  )}
                >
                  {cur ? <CurrencyFlag currency={cur} size={22} /> : <span className="text-[10px] text-slate-500">{r.code}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] truncate flex items-center gap-1.5 text-foreground" style={{ fontWeight: 600 }}>
                    {r.code}
                    {isBase && (
                      <span
                        className="inline-flex items-center px-1.5 py-[1px] rounded-full bg-primary text-white text-[9px] tracking-wide uppercase leading-none"
                        style={{ fontWeight: 700 }}
                      >
                        Base
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 block truncate">{name}</span>
                </div>
                <span className="text-[11px] text-slate-600 tabular-nums shrink-0" style={{ fontWeight: 500 }}>
                  {r.partnerCount} {r.partnerCount === 1 ? "partner" : "partners"}
                </span>
              </div>
            );
          })}
        </div>
        {/* Footer — summary + active rate type */}
        <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground/70">
            Across {totalPartners} {totalPartners === 1 ? "partner" : "partners"}
            <span className="mx-1 text-muted-foreground/40">·</span>
            Base <span className="text-foreground" style={{ fontWeight: 600 }}>{baseSym} {BASE_CURRENCY}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aggTypeHex }} />
            <span style={{ color: aggTypeHex, fontWeight: 600 }}>{aggTypeLabel}</span>
          </span>
          {scrollable && (
            <span className="basis-full text-[10px] text-muted-foreground/40 italic text-right">Scroll for more</span>
          )}
        </div>
      </div>
    );
  }

  // single — used by detail-page money cells. For foreign-currency cells we
  // surface the same rich panel as `listing-partner` so the hover tells you
  // both the base equivalent and which rate book the conversion came from.
  // Base-currency cells skip the hover entirely (handled in `shouldShowHover`).
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSymbol = baseCur.symbol ?? baseCur.code;
  const baseValue = convertBetween(props.value, c.code, BASE_CURRENCY);
  return (
    <>
      <HeaderLine flag={flag} name={c.name} code={c.code} tail="— partner currency" />
      <div className="border-t border-slate-100 my-2" />
      <div className="text-[12px] text-slate-700">
        Base equivalent: {baseSymbol} {formatNumber(baseValue, BASE_CURRENCY)} {baseCur.code}
      </div>
      <RateLine partnerCode={c.code} />
    </>
  );
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
