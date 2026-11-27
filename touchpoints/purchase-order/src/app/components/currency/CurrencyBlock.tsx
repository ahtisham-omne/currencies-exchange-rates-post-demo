import * as React from "react";
import { Lock, LockOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { BASE_CURRENCY, getCurrency } from "@/app/currency/currencies";
import { formatMoney, formatRate, moneyPrefix } from "@/app/currency/money";
import { RATE_TYPE_LABEL, type RateType } from "@/app/currency/rates";
import { CurrencyFlag } from "./CurrencyChip";

/* ── The currency block ───────────────────────────────────────────────
 * One layout for a document's currency summary (Currency Touchpoints Map,
 * "cblk"), built on Order Summary's CURRENCY card: the uppercase label, the
 * rate type and the lock, rows of a 10px slate-400 label and a 12px
 * slate-700 value with its flag ("$10,136.20 USD"), a hairline, then the
 * Rate row ("1 USD = ₨278.5200 PKR · today"). A base-currency document
 * gets the short no-conversion line instead of rows. Used by Order Summary
 * (POCurrencySummary) and the Receiving Docs tab. */

const RATE_HEX: Record<RateType, string> = { mid: "#7C3AED", corporate: "#B45309" };
const RATE_TINT: Record<RateType, string> = { mid: "rgba(124,58,237,0.08)", corporate: "rgba(180,83,9,0.10)" };

/** "Rs 645.20 PKR": an amount with its code, as the block writes it. */
export const withCode = (n: number, code: string) => {
  const t = formatMoney(n, code);
  return t.includes(code) ? t : `${t} ${code}`;
};

/** "1 USD = ₨278.5200 PKR"; into another currency, "1 USD = C$1.3935 CAD". */
export const blockRateText = (code: string, rate: number, to: string = BASE_CURRENCY) =>
  `1 ${code} = ${moneyPrefix(to)}${formatRate(rate)} ${to}`;

export function RateTypeChip({ type }: { type: RateType }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
      style={{ color: RATE_HEX[type], backgroundColor: RATE_TINT[type], fontWeight: 600 }}
    >
      <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: RATE_HEX[type] }} />
      {RATE_TYPE_LABEL[type]}
    </span>
  );
}

/** Locked (green) or Unlocked (amber), with when it locks in its title. */
export function LockChip({ locked, title }: { locked: boolean; title?: string }) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] cursor-default whitespace-nowrap"
      style={locked ? { color: "#047857", backgroundColor: "#ECFDF5", fontWeight: 600 } : { color: "#92400E", backgroundColor: "#FFFBEB", fontWeight: 600 }}
      title={title}
    >
      <Icon className="w-2.5 h-2.5" />
      {locked ? "Locked" : "Unlocked"}
    </span>
  );
}

export interface CurrencyBlockRow {
  label: string;
  code: string;
  /** The amount in `code`. Leave out to show the currency itself:
   *  "Pakistani Rupee (PKR)" (the "You pay in" row). */
  amount?: number;
  /** Shown on hover of the row, e.g. the pay-from account. */
  title?: string;
  /** An estimate: written "≈ C$14,120.55 CAD". */
  approx?: boolean;
  /** Written as is in place of the amount or the currency name, e.g. an
   *  account or a rate (27 Nov 2026). */
  value?: React.ReactNode;
  /** A muted line under the value, e.g. "Estimate at today's rate" or the
   *  rate type chip (27 Nov 2026). */
  sub?: React.ReactNode;
  /** Leave out the flag before the value. */
  noFlag?: boolean;
}

/** "Pakistani Rupee (PKR)": a currency by name, as the block writes it. */
export const currencyNameWithCode = (code: string) => {
  const upper = code.toUpperCase();
  return `${getCurrency(upper)?.name ?? upper} (${upper})`;
};

export function CurrencyBlock({
  isBase,
  rateType,
  rateTypeTip,
  lock,
  rows,
  rate,
  note,
  footer,
  className = "",
}: {
  /** A base-currency document: no conversion to show. */
  isBase: boolean;
  rateType?: RateType;
  rateTypeTip?: React.ReactNode;
  /** Shown on a foreign-currency document. */
  lock?: { locked: boolean; title: string } | null;
  rows: CurrencyBlockRow[];
  /** The Rate row: "1 USD = ₨278.5200 PKR", then " · <qualifier>". `to` is
   *  the currency it converts into, the base currency unless given. */
  rate?: { code: string; rate: number; to?: string; qualifier?: string } | null;
  /** A muted line under the rows, e.g. that an amount is an estimate. */
  note?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.06em" }}>
          Currency information
        </span>
        {/* No lock on the rate (25 Nov 2026): the configuration locks with the
            document, the exchange rate shows no lock of its own. */}
      </div>

      {isBase ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : (
        <>
          {rows.map((r) => {
            const value = (
              <p className="flex items-center justify-end gap-1.5 text-slate-700 tabular-nums text-right min-w-0" style={{ fontSize: 12, fontWeight: 500 }}>
                {/* A flag on the document's amount and the account's currency; the base equivalent reads plainly. */}
                {!r.noFlag && r.value === undefined && (r.amount === undefined || r.code.toUpperCase() !== BASE_CURRENCY) && (
                  <CurrencyFlag code={r.code} size={11} />
                )}
                {r.value !== undefined ? (
                  r.value
                ) : (
                  <span className="truncate">
                    {r.amount !== undefined && r.approx ? "≈ " : ""}
                    {r.amount === undefined ? currencyNameWithCode(r.code) : withCode(r.amount, r.code)}
                  </span>
                )}
              </p>
            );
            // With a sub-line the label sits on the value's line, as the Exchange rate row's does.
            return r.sub ? (
              <div key={r.label} className="flex items-start justify-between gap-2" title={r.title}>
                <p className="text-slate-400 shrink-0 pt-0.5" style={{ fontSize: 10, fontWeight: 500 }}>
                  {r.label}
                </p>
                <div className="flex flex-col items-end gap-1 min-w-0">
                  {value}
                  <div className="text-slate-400 text-right" style={{ fontSize: 10 }}>{r.sub}</div>
                </div>
              </div>
            ) : (
              <div key={r.label} className="flex items-center justify-between gap-2" title={r.title}>
                <p className="text-slate-400 shrink-0" style={{ fontSize: 10, fontWeight: 500 }}>
                  {r.label}
                </p>
                {value}
              </div>
            );
          })}
          {rate && (
            <div className="flex items-start justify-between gap-2">
              <p className="text-slate-400 shrink-0 pt-0.5" style={{ fontSize: 10, fontWeight: 500 }}>Exchange rate</p>
              <div className="flex flex-col items-end min-w-0">
              <p className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 text-slate-700 tabular-nums text-right" style={{ fontSize: 12, fontWeight: 500 }}>
                <span className="whitespace-nowrap">{blockRateText(rate.code, rate.rate, rate.to)}</span>
                {rateType &&
                  (rateTypeTip ? (
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <span className="cursor-help shrink-0">
                          <RateTypeChip type={rateType} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                        {rateTypeTip}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="shrink-0"><RateTypeChip type={rateType} /></span>
                  ))}
              </p>
              {rate.qualifier && <p className="text-slate-400 text-right" style={{ fontSize: 10 }}>{rate.qualifier}</p>}
              </div>
            </div>
          )}
          {note && <p className="text-slate-400 leading-snug" style={{ fontSize: 10.5 }}>{note}</p>}
        </>
      )}

      {footer}
    </div>
  );
}
