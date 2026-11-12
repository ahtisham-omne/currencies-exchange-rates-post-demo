import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { cn } from "@/app/components/ui/utils";
import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "@/app/currency/currencies";
import { formatAmount, formatCompactMoney, formatMoney, moneyPrefix, rateSentence } from "@/app/currency/money";
import { RATE_PROVIDER, RATE_TYPE_LABEL } from "@/app/currency/rates";
import { MID_RATE_UPDATED, convertNow, currentRate } from "@/app/currency/partnerCurrency";
import { formatMoneyWithCode, type CurrencyStream } from "@/app/currency/partnerAmounts";
import { CurrencyFlag } from "./CurrencyFlag";
import { FX_ARROW_PADDING, FX_CARD_CLASS, FxArrow, FxHead, FxInset, FxLine, FxLines, FxNote, FxRateType } from "./FxCard";

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
        className={cn(FX_CARD_CLASS, "z-[300]", props.mode === "aggregated-base" && "min-w-[280px]")}
        arrow={<FxArrow />}
        arrowPadding={FX_ARROW_PADDING}
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

/** Flag and name of the currency the card is about, and what it is to the partner. */
function CardHead({ code, role }: { code: string; role: string }) {
  return <FxHead flag={<CurrencyFlag code={code} className="text-[15px]" />} name={getCurrency(code)?.name ?? code} code={code} role={role} />;
}

/** Today's mid-market rate for a currency, where it comes from and when it was last synced. */
export function RateLine({ code, lead = "At" }: { code: string; lead?: string }) {
  const rate = currentRate(code).rate;
  return (
    <>
      {rate != null && <FxNote>{lead} {rateSentence(code, rate)}</FxNote>}
      <FxRateType type="mid" label={RATE_TYPE_LABEL.mid} source={RATE_PROVIDER} />
      <FxNote small>{MID_RATE_UPDATED}</FxNote>
    </>
  );
}

/* The shared currency card (FxCard), as the rate card and Chart of Accounts'
   FX card lay it out: the partner's currency on top, the amount in it, then a
   grey block with the base-currency figure and today's rate. */
function TooltipBody(props: CurrencyAmountProps) {
  const code = props.currency;

  if (props.mode === "listing-base") {
    // The cell shows the base figure; the card leads with the partner's own.
    const partner = (props.partnerCurrency ?? code).toUpperCase();
    return (
      <>
        <CardHead code={partner} role="partner currency" />
        <FxLines>
          <FxLine label={`In ${partner}`} value={formatMoneyWithCode(props.partnerValue ?? 0, partner)} />
        </FxLines>
        <FxInset>
          <FxLine strong label={`In ${BASE_CURRENCY} (base)`} value={formatMoneyWithCode(props.value, BASE_CURRENCY)} />
          <RateLine code={partner} />
        </FxInset>
      </>
    );
  }

  if (props.mode === "partner-rolled-up") {
    const rows = props.rollupBreakdown ?? [];
    return (
      <>
        <CardHead code={code} role="rolled up" />
        <FxLines>
          {rows.map((r) => {
            const same = r.code.toUpperCase() === code;
            return (
              <FxLine
                key={r.code}
                label={`${r.code.toUpperCase()} · ${r.txCount} transactions`}
                value={`${same ? "" : "≈ "}${formatMoneyWithCode(same ? r.amount : convertNow(r.amount, r.code, code), code)}`}
              />
            );
          })}
        </FxLines>
        <FxInset>
          <FxLine strong label={`Total in ${code}`} value={formatMoneyWithCode(props.value, code)} />
          <FxNote>
            Across {rows.length} {rows.length === 1 ? "currency" : "currencies"}, converted at today's rates
          </FxNote>
          <FxRateType type="mid" label={RATE_TYPE_LABEL.mid} source={RATE_PROVIDER} />
        </FxInset>
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
      <>
        <FxHead name="Currencies" role={`${rows.length} in use`} />
        <div
          className={cn("mt-[8px] -mx-[6px]", scrollable && "overflow-y-auto overscroll-contain")}
          style={{ maxHeight: scrollable ? 5 * 36 : undefined }}
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
                className={cn("flex items-center gap-[8px] h-[36px] px-[6px] rounded-[8px] whitespace-nowrap", isBase && "bg-primary/5")}
              >
                <span className="inline-flex shrink-0 leading-none"><CurrencyFlag code={r.code} className="text-[15px]" /></span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] leading-[16px] flex items-center gap-[6px] text-[#0F1729]" style={{ fontWeight: 600 }}>
                    {r.code}
                    {isBase && (
                      <span className="inline-flex items-center px-1.5 py-[1px] rounded-full bg-primary text-white text-[9px] tracking-wide uppercase leading-none" style={{ fontWeight: 700 }}>
                        Base
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] leading-[14px] text-[#48566A] block truncate">{getCurrency(r.code)?.name ?? r.code}</span>
                </div>
                <span className="text-[12px] leading-[16px] text-[#0F1729] tabular-nums shrink-0 pl-[16px]" style={{ fontWeight: 500 }}>
                  {r.partnerCount} {r.partnerCount === 1 ? "partner" : "partners"}
                </span>
              </div>
            );
          })}
        </div>
        <FxInset>
          <FxLine strong label={`In ${BASE_CURRENCY} (base)`} value={formatMoneyWithCode(props.value, BASE_CURRENCY)} />
          <FxNote>
            Across {totalPartners} {totalPartners === 1 ? "partner" : "partners"}, converted at today's rates
          </FxNote>
          <FxRateType type="mid" label={RATE_TYPE_LABEL.mid} source={RATE_PROVIDER} />
          {scrollable && <FxNote small>Scroll the list for more currencies</FxNote>}
        </FxInset>
      </>
    );
  }

  // single / listing-partner: an amount in the partner's currency.
  return (
    <>
      <CardHead code={code} role="partner currency" />
      <FxLines>
        <FxLine label={`In ${code}`} value={formatMoneyWithCode(props.value, code)} />
      </FxLines>
      <FxInset>
        <FxLine strong label={`In ${BASE_CURRENCY} (base)`} value={formatMoneyWithCode(convertNow(props.value, code, BASE_CURRENCY), BASE_CURRENCY)} />
        <RateLine code={code} />
      </FxInset>
    </>
  );
}
