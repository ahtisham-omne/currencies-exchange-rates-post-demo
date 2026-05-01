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
import { useRateContext } from "@/app/context/RateContext";

export type CurrencyAmountMode = "single" | "listing-base" | "listing-partner";

export interface CurrencyAmountProps {
  value: number;
  currency: string;
  mode: CurrencyAmountMode;
  /** Required when `mode="listing-base"` — the partner's currency for the hover line. */
  partnerDefaultCurrency?: string;
  /** Required when `mode="listing-base"` — the partner-currency raw amount to show in the hover. */
  partnerDefaultValue?: number;
  /** Optional rate override (base-per-1-foreign) for the primary "Invoice rate" line. */
  lockedRate?: number;
  /** Optional ISO timestamp for `lockedRate`. */
  lockedAt?: string;
  /** Optional second rate (base-per-1-foreign) for the "PO creation rate" line. Vendor-invoice specific. */
  poRate?: number;
  /** Optional ISO timestamp for `poRate`. */
  poRateAt?: string;
  /** Optional caption for the primary rate line — defaults to "Invoice rate" when `lockedRate` is provided, "Current rate" otherwise. */
  lockedRateLabel?: string;
  signed?: boolean;
  className?: string;
}

/**
 * Display a financial amount with a Currency-Library-style hover that explains
 * the currency context. Symbol gets a dotted underline + help cursor.
 *
 * Vendor-invoicing extension: when `poRate` is supplied, an extra row is
 * rendered in the rate panel showing the PO's locked rate at commitment time.
 * This lets users see both the invoice-date rate and the PO-date rate side by
 * side — useful for tracking FX impact between commitment and invoicing.
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
    <span
      dir="ltr"
      className={cn("inline-flex items-baseline whitespace-nowrap tabular-nums", className)}
      style={{ unicodeBidi: "isolate" }}
    >
      {sign}
      <bdi
        className={cn(
          "mr-1",
          showHover && "border-b border-dotted border-slate-400 leading-none pb-[1px]",
        )}
      >
        {symbol}
      </bdi>
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
          "w-auto min-w-[260px] max-w-[340px] p-3",
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

function RatePanel({
  partnerCode,
  lockedRate,
  lockedAt,
  poRate,
  poRateAt,
}: {
  partnerCode: string;
  lockedRate?: number;
  lockedAt?: string;
  lockedRateLabel?: string;
  poRate?: number;
  poRateAt?: string;
}) {
  const snap = activeRateSnapshot();
  const sameAsBase = partnerCode.toUpperCase() === BASE_CURRENCY;
  if (sameAsBase) return null;

  const baseCur = getLibraryCurrency(BASE_CURRENCY);
  const baseSym = baseCur?.symbol ?? BASE_CURRENCY;
  const code = partnerCode.toUpperCase();
  const primaryRate = lockedRate ?? rateToBase(partnerCode);
  const isLocked = lockedRate !== undefined;
  const typeLabelText = rateTypeLabel(snap.type);
  const hex = snap.type === "market" ? "#7c3aed" : "#d97706";
  const primaryDate = formatLockedDate(isLocked ? lockedAt : snap.lastSyncAt);
  const primaryDatePrefix = isLocked ? "Locked on" : "Updated as of";
  const primaryDateSuffix = isLocked ? " — invoice date" : "";

  return (
    <div className="mt-1.5 px-2 py-1.5 rounded-md bg-slate-50 border border-slate-100">
      {/* Primary rate · Mid-market combined on one line */}
      <div className="text-[11px] text-slate-700 tabular-nums leading-4" dir="ltr">
        1 {code} = <bdi>{baseSym}</bdi> {formatNumber(primaryRate, BASE_CURRENCY)} {BASE_CURRENCY}
        <span className="text-slate-400"> · </span>
        <span style={{ color: hex, fontWeight: 600 }}>{typeLabelText.replace(" rate", "")}</span>
      </div>
      {/* Source line — kept as a separate row, dot indicator preserved */}
      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} />
        <span className="text-slate-400">Source: {snap.source}</span>
      </div>
      {primaryDate && (
        <div className="text-[10px] text-slate-400 mt-0.5">
          {primaryDatePrefix} {primaryDate}{primaryDateSuffix}
        </div>
      )}
      {/* PO creation rate (vendor-invoicing specific). Same compact shape:
          rate line + locked-on date with "PO send date" qualifier. */}
      {poRate !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-200/60">
          <div className="text-[11px] text-slate-700 tabular-nums leading-4" dir="ltr">
            1 {code} = <bdi>{baseSym}</bdi> {formatNumber(poRate, BASE_CURRENCY)} {BASE_CURRENCY}
            <span className="text-slate-400"> · </span>
            <span className="text-slate-500" style={{ fontWeight: 600 }}>PO creation</span>
          </div>
          {poRateAt && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              Locked on {formatLockedDate(poRateAt)} — PO send date
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Date-only formatter for "Locked on …" rows. Strips the time component
 * because for accounting purposes the day the rate was captured is the
 * meaningful unit, not the minute.
 */
function formatLockedDate(input: string | Date | undefined | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
        <div className="text-[12px] text-slate-700" dir="ltr">
          Vendor currency: <bdi>{partnerSymbol}</bdi> {formatNumber(props.partnerDefaultValue ?? 0, partner.code)} {partner.code}
        </div>
        <RatePanel
          partnerCode={partner.code}
          lockedRate={props.lockedRate}
          lockedAt={props.lockedAt}
          lockedRateLabel={props.lockedRateLabel}
          poRate={props.poRate}
          poRateAt={props.poRateAt}
        />
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
        <HeaderLine flag={flag} name={c.name} code={c.code} tail="— vendor currency" />
        <div className="border-t border-slate-100 my-2" />
        <div className="text-[12px] text-slate-700" dir="ltr">
          Base equivalent: <bdi>{baseSymbol}</bdi> {formatNumber(baseValue, BASE_CURRENCY)} {baseCur.code}
        </div>
        <RatePanel
          partnerCode={c.code}
          lockedRate={props.lockedRate}
          lockedAt={props.lockedAt}
          lockedRateLabel={props.lockedRateLabel}
          poRate={props.poRate}
          poRateAt={props.poRateAt}
        />
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
