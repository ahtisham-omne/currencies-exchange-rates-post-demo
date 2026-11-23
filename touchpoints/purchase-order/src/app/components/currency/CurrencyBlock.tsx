import * as React from "react";
import { Lock, LockOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { BASE_CURRENCY } from "@/app/currency/currencies";
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

/** "1 USD = ₨278.5200 PKR" */
export const blockRateText = (code: string, rate: number) =>
  `1 ${code} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)} ${BASE_CURRENCY}`;

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
  amount: number;
  /** Shown on hover of the label, e.g. the pay-from account. */
  title?: string;
}

export function CurrencyBlock({
  isBase,
  rateType,
  rateTypeTip,
  lock,
  rows,
  rate,
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
  /** The Rate row: "1 USD = ₨278.5200 PKR", then " · <qualifier>". */
  rate?: { code: string; rate: number; qualifier?: string } | null;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9.5px] uppercase text-slate-400" style={{ fontWeight: 600, letterSpacing: "0.06em" }}>
          Currency
        </span>
        {!isBase && (
          <div className="flex items-center gap-1.5">
            {rateType &&
              (rateTypeTip ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <RateTypeChip type={rateType} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-[11px]">
                    {rateTypeTip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <RateTypeChip type={rateType} />
              ))}
            {lock && <LockChip locked={lock.locked} title={lock.title} />}
          </div>
        )}
      </div>

      {isBase ? (
        <p className="text-slate-400" style={{ fontSize: 10.5 }}>
          {BASE_CURRENCY} is the base currency, so there's no conversion.
        </p>
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }} title={r.title}>
                {r.label}
              </p>
              <p className="flex items-center gap-1.5 text-slate-700 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}>
                <CurrencyFlag code={r.code} size={11} />
                {withCode(r.amount, r.code)}
              </p>
            </div>
          ))}
          {rate && (
            <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
              <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>Rate</p>
              <p className="text-slate-500 tabular-nums text-right" style={{ fontSize: 11 }}>
                {blockRateText(rate.code, rate.rate)}
                {rate.qualifier ? ` · ${rate.qualifier}` : ""}
              </p>
            </div>
          )}
        </>
      )}

      {footer}
    </div>
  );
}
