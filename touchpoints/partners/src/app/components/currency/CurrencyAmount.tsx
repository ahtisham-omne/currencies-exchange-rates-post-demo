import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { cn } from "@/app/components/ui/utils";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { formatAmount, formatCompactMoney, formatMoney, moneyPrefix, rateSentence } from "@/app/currency/money";
import { RATE_PROVIDER, RATE_TYPE_LABEL } from "@/app/currency/rates";
import { MID_RATE_UPDATED, convertNow, currentRate } from "@/app/currency/partnerCurrency";
import { formatMoneyWithCode, type CurrencyStream } from "@/app/currency/partnerAmounts";
import { CurrencyFlag } from "./CurrencyFlag";

export type CurrencyAmountMode = "single" | "listing-base" | "listing-partner" | "aggregated-base" | "partner-rolled-up";

export interface CurrencyAmountProps {
  /** The amount, already in `currency`. */
  value: number;
  /** ISO 4217 code of `value`, any case. */
  currency: string;
  /** Which hover the amount gets. */
  mode: CurrencyAmountMode;
  /** listing-base: the partner's currency and the amount in it, for the hover. */
  partnerCurrency?: string;
  partnerValue?: number;
  /** aggregated-base: how many partners use each currency. */
  partnerBreakdown?: { code: string; partnerCount: number }[];
  /** partner-rolled-up: the partner's transactions per currency. */
  rollupBreakdown?: CurrencyStream[];
  /** KPI-sized: 750.3M rather than 750,312,004.00. */
  compact?: boolean;
  className?: string;
}

// The module's mid-market colour (purple), as the Quotes and Sales Order touchpoints use it.
const MID_HEX = "#7c3aed";

/**
 * An amount with its currency's symbol, and a hover that says what it is in
 * the other currency and at what rate. The symbol is underlined (dotted) when
 * there is a hover. No hover for zero, or where the amount is already in the
 * base currency and nothing else is involved.
 */
export function CurrencyAmount(props: CurrencyAmountProps) {
  const { value, currency, compact, className } = props;
  const code = (getCurrency(currency)?.code ?? currency).toUpperCase();
  const showHover = shouldShowHover(props, code);
  const prefix = moneyPrefix(code).trim();

  const body = (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      {value < 0 && "−"}
      <span className={cn("mr-1", showHover && "border-b border-dotted border-slate-400 leading-none pb-[1px]")}>{prefix}</span>
      <span>{compact ? formatCompactMoney(Math.abs(value), code).slice(moneyPrefix(code).length) : formatAmount(value, code)}</span>
    </span>
  );

  if (!showHover) return body;

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${formatMoney(value, code)} (${getCurrency(code)?.name ?? code})`}
          className="inline-flex items-baseline cursor-help bg-transparent p-0 m-0 border-0 text-left"
          style={{ font: "inherit", color: "inherit", letterSpacing: "inherit", lineHeight: "inherit" }}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className={cn(
          "rounded-lg border border-slate-200 shadow-lg bg-white z-[300]",
          props.mode === "aggregated-base" ? "w-[280px] p-0 overflow-hidden" : "w-auto min-w-[260px] max-w-[320px] p-3",
        )}
      >
        <TooltipBody {...props} currency={code} />
      </HoverCardContent>
    </HoverCard>
  );
}

function shouldShowHover(props: CurrencyAmountProps, code: string): boolean {
  if (props.value === 0) return false;
  switch (props.mode) {
    case "listing-base":
      return !!props.partnerCurrency && !isBaseCurrency(props.partnerCurrency);
    case "partner-rolled-up":
      return (props.rollupBreakdown?.length ?? 0) > 1;
    case "aggregated-base":
      return true;
    default:
      return !isBaseCurrency(code);
  }
}

function HeaderLine({ code, tail }: { code: string; tail: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[13px] font-semibold text-slate-900">
      <span className="self-center"><CurrencyFlag code={code} /></span>
      <span>{getCurrency(code)?.name ?? code} ({code})</span>
      <span className="text-slate-500 font-normal">{tail}</span>
    </div>
  );
}

/** Today's rate for a currency, where it comes from and when it was last synced. */
export function RateLine({ code }: { code: string }) {
  const rate = currentRate(code).rate;
  return (
    <div className="mt-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
      {rate != null && (
        <div className="text-[11px] text-slate-700 tabular-nums leading-4">
          <span className="text-slate-500" style={{ fontWeight: 500 }}>Current rate: </span>
          {rateSentence(code, rate)}
        </div>
      )}
      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MID_HEX }} />
        <span style={{ color: MID_HEX, fontWeight: 600 }}>{RATE_TYPE_LABEL.mid} rate</span>
        <span className="text-slate-400">· Source: {RATE_PROVIDER}</span>
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5">{MID_RATE_UPDATED}</div>
    </div>
  );
}

function TooltipBody(props: CurrencyAmountProps) {
  const code = props.currency;

  if (props.mode === "listing-base") {
    const partner = (props.partnerCurrency ?? code).toUpperCase();
    return (
      <>
        <HeaderLine code={code} tail="— base currency" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700">
          Partner currency: {formatMoneyWithCode(props.partnerValue ?? 0, partner)}
        </div>
        <RateLine code={partner} />
      </>
    );
  }

  if (props.mode === "partner-rolled-up") {
    const rows = props.rollupBreakdown ?? [];
    return (
      <>
        <HeaderLine code={code} tail="— rolled up" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-500 mb-1.5">
          Across {rows.length} {rows.length === 1 ? "currency" : "currencies"}
        </div>
        {rows.map((r) => {
          const same = r.code.toUpperCase() === code;
          return (
            <div key={r.code} className="text-[12px] text-slate-700 leading-5">
              {r.code.toUpperCase()} · {r.txCount} transactions · {same ? "" : "≈ "}
              {formatMoney(same ? r.amount : convertNow(r.amount, r.code, code), code)}
            </div>
          );
        })}
        <div className="text-[10px] text-slate-400 mt-1.5">
          Converted at today's {RATE_TYPE_LABEL.mid.toLowerCase()} rates · {RATE_PROVIDER}
        </div>
      </>
    );
  }

  if (props.mode === "aggregated-base") {
    // The base currency first, then the rest by partner count.
    const all = props.partnerBreakdown ?? [];
    const rows = [
      ...all.filter((r) => isBaseCurrency(r.code)),
      ...all.filter((r) => !isBaseCurrency(r.code)).sort((a, b) => b.partnerCount - a.partnerCount),
    ];
    const totalPartners = rows.reduce((n, r) => n + r.partnerCount, 0);
    const scrollable = rows.length > 5;
    return (
      <div className="w-full">
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] tracking-wide uppercase text-muted-foreground/70" style={{ fontWeight: 600 }}>Currencies</span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{rows.length}</span>
        </div>
        <div
          className={cn("px-1.5 pb-1.5", scrollable && "overflow-y-auto overscroll-contain")}
          style={{ maxHeight: scrollable ? 5 * 44 : undefined }}
          // A Radix Dialog's scroll lock swallows wheel events on portaled
          // content; scroll the list by hand so it still scrolls in one.
          onWheelCapture={scrollable ? (e) => {
            const el = e.currentTarget;
            if (el.scrollHeight <= el.clientHeight) return;
            el.scrollTop += e.deltaY;
            e.preventDefault();
            e.stopPropagation();
          } : undefined}
        >
          {rows.map((r) => {
            const isBase = isBaseCurrency(r.code);
            return (
              <div
                key={r.code}
                className={cn("flex items-center gap-2.5 px-2.5 py-2 rounded-md", isBase && "bg-primary/5 ring-1 ring-inset ring-primary/15")}
              >
                <div
                  className={cn(
                    "shrink-0 w-7 h-7 rounded-md overflow-hidden border flex items-center justify-center",
                    isBase ? "bg-white border-primary/25" : "bg-muted border-[#E8ECF1]",
                  )}
                >
                  <CurrencyFlag code={r.code} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] truncate flex items-center gap-1.5 text-foreground" style={{ fontWeight: 600 }}>
                    {r.code}
                    {isBase && (
                      <span className="inline-flex items-center px-1.5 py-[1px] rounded-full bg-primary text-white text-[9px] tracking-wide uppercase leading-none" style={{ fontWeight: 700 }}>
                        Base
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 block truncate">{getCurrency(r.code)?.name ?? r.code}</span>
                </div>
                <span className="text-[11px] text-slate-600 tabular-nums shrink-0" style={{ fontWeight: 500 }}>
                  {r.partnerCount} {r.partnerCount === 1 ? "partner" : "partners"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground/70">
            Across {totalPartners} {totalPartners === 1 ? "partner" : "partners"}
            <span className="mx-1 text-muted-foreground/40">·</span>
            Base <span className="text-foreground" style={{ fontWeight: 600 }}>{moneyPrefix(BASE_CURRENCY).trim()} {BASE_CURRENCY}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MID_HEX }} />
            <span style={{ color: MID_HEX, fontWeight: 600 }}>{RATE_TYPE_LABEL.mid} rate</span>
          </span>
          {scrollable && <span className="basis-full text-[10px] text-muted-foreground/40 italic text-right">Scroll for more</span>}
        </div>
      </div>
    );
  }

  // single / listing-partner: an amount in the partner's currency.
  return (
    <>
      <HeaderLine code={code} tail="— partner currency" />
      <div className="border-t border-slate-100 my-2" />
      <div className="text-[12px] text-slate-700">
        Base equivalent: {formatMoneyWithCode(convertNow(props.value, code, BASE_CURRENCY), BASE_CURRENCY)}
      </div>
      <RateLine code={code} />
    </>
  );
}
