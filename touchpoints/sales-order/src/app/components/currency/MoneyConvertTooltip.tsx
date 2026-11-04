import * as React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { CurrencyFlag } from "./CurrencyFlag";
import {
  BASE_CURRENCY,
  activeRateSnapshot,
  convertBetween,
  getLibraryCurrency,
  rateToBase,
  rateTypeLabel,
} from "@/app/data/currencyLibrary";
import { formatRateUpdatedAs } from "@/app/data/rateDateFormat";
import { useRateContext } from "@/app/context/RateContext";

interface Props {
  /** Amount in base currency (PKR). */
  valuePKR: number;
  /** Customer's order currency. Returns children unwrapped when this matches base. */
  customerCurrency?: string;
  /** Optional locked rate (base-per-1-customer) — wins over the live snapshot. */
  lockedRate?: number;
  /** ISO timestamp the rate was locked, used in the tooltip's rate line. */
  lockedAt?: string;
  /**
   * @deprecated kept for compatibility — ignored now that the popover is
   * positioned automatically by the underlying HoverCard.
   */
  position?: "top" | "bottom";
  /** Force the trigger to expand to fill its parent. Useful for table cells. */
  block?: boolean;
  /**
   * When the displayed amount is in customer currency, the tooltip should
   * surface the BASE equivalent instead of the customer one. Defaults to
   * "base" (i.e. children show base, tooltip shows customer).
   */
  display?: "base" | "customer";
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps any monetary display with a Currency-Library-style hover popover that
 * surfaces the alternate currency, the active rate context, and source meta.
 * Use this wrapper around custom-styled triggers (editable cells, compact
 *-formatted spans). For plain amount cells, prefer `OrderMoney` which has
 * the same hover affordance built in via `CurrencyAmount`.
 *
 * No-op (renders children unwrapped) when the customer currency equals base —
 * matches the product rule that base==customer orders surface no FX context.
 */
export function MoneyConvertTooltip({
  valuePKR,
  customerCurrency,
  lockedRate,
  lockedAt,
  block,
  display = "base",
  className,
  children,
}: Props) {
  useRateContext();
  const code = (customerCurrency || BASE_CURRENCY).toUpperCase();
  const isBase = code === BASE_CURRENCY;

  if (isBase) return <>{children}</>;

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          className={`${block ? "inline-block w-full" : "inline-flex"} cursor-help ${className ?? ""}`}
        >
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="rounded-lg border border-slate-200 shadow-lg bg-white w-auto min-w-[260px] max-w-[320px] p-3"
      >
        <PopoverBody
          valuePKR={valuePKR}
          code={code}
          lockedRate={lockedRate}
          lockedAt={lockedAt}
          display={display}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

function PopoverBody({
  valuePKR,
  code,
  lockedRate,
  lockedAt,
  display,
}: {
  valuePKR: number;
  code: string;
  lockedRate?: number;
  lockedAt?: string;
  display: "base" | "customer";
}) {
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const customerCur = getLibraryCurrency(code) ?? baseCur;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const customerSym = customerCur.symbol ?? code;
  const customerValue = typeof lockedRate === "number"
    ? valuePKR / lockedRate
    : convertBetween(valuePKR, BASE_CURRENCY, code);

  if (display === "customer") {
    // Trigger shows customer-currency amount → popover headlines customer
    // currency, body line surfaces base equivalent.
    return (
      <>
        <HeaderLine
          flag={<CurrencyFlag currency={customerCur} size={18} />}
          name={customerCur.name}
          code={customerCur.code}
          tail="— customer currency"
        />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700">
          Base equivalent: {baseSym} {formatNumber(valuePKR, BASE_CURRENCY)} {BASE_CURRENCY}
        </div>
        <RateLine partnerCode={customerCur.code} lockedRate={lockedRate} lockedAt={lockedAt} />
      </>
    );
  }

  // Trigger shows base PKR → popover headlines base, body line surfaces
  // customer-currency amount.
  return (
    <>
      <HeaderLine
        flag={<CurrencyFlag currency={baseCur} size={18} />}
        name={baseCur.name}
        code={baseCur.code}
        tail="— base currency"
      />
      <div className="border-t border-slate-100 my-2" />
      <div className="text-[12px] text-slate-700">
        Customer currency: {customerSym} {formatNumber(customerValue, customerCur.code)} {customerCur.code}
      </div>
      <RateLine partnerCode={customerCur.code} lockedRate={lockedRate} lockedAt={lockedAt} />
    </>
  );
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

function formatNumber(value: number, code: string): string {
  const zeroDecimals = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "ISK", "CLP"]);
  const threeDecimals = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);
  const upper = code.toUpperCase();
  const decimals = zeroDecimals.has(upper) ? 0 : threeDecimals.has(upper) ? 3 : 2;
  return Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
