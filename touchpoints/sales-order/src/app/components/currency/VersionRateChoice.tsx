import * as React from "react";
import { currentRateFor, type VersionRateChoice as Choice } from "@/app/components/so/soCurrency";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { formatMoney, formatRateDate, rateSentence } from "@/app/currency/money";
import { soFx, type SoFxFields } from "@/app/currency/soFx";
import { RATE_TYPE_LABEL, toBase, type RateType } from "@/app/currency/rates";

const FONT = "Inter, system-ui, sans-serif";

/* ── A new version's rate: the locked one, or today's ─────────────────
 * Ported from the earlier Sales Orders touchpoint's revert prompt ("Restore
 * locked rate from V{n}" / "Refresh to today's rate"). Worded as the
 * Currency Touchpoints Map has it since 24 Nov 2026: "Keep version {n}'s
 * rate" / "Use today's rate" (before: "Use locked rate from V{n}" / "Apply
 * current rate"). Shown when a version is started and when one is reverted
 * to, on an order in a foreign currency. Each option names its rate; today's
 * can be mid-market or corporate when a corporate rate is set (Mahreen,
 * 2026-11-20). The customer's prices don't change either way; the
 * base-currency totals do. */

export interface VersionRateOptions {
  /** The rate the version locked in: "Mid-market · 1 USD = 278.5200 PKR ·
   *  Nov 19, 2026", then the base total when there is one. */
  locked: string;
  /** Today's rate of each type; corporate only when a corporate rate is set. */
  today: { mid: TodayRate; corporate?: TodayRate | undefined };
  /** The type "Use today's rate" starts on: the locked rate's, when today
   *  has one of that type. */
  defaultType: RateType;
}

interface TodayRate {
  line: string;
  /** False when it is the locked rate. */
  differs: boolean;
}

type Stamp = { exchangeRate: number; rateType: RateType; rateDate: string };

/** "Mid-market · 1 USD = 278.5200 PKR · Nov 19, 2026". */
function rateLine(currency: string, type: RateType, rate: number, day: string): string {
  return `${RATE_TYPE_LABEL[type]} · ${rateSentence(currency, rate)} · ${day}`;
}

function buildOptions(
  currency: string,
  locked: { rate: number; rateType: RateType; rateDate: string },
  todayOf: (type: RateType) => Stamp,
  total?: number,
): VersionRateOptions {
  const withTotal = total != null && Number.isFinite(total);
  const inBase = (rate: number) => formatMoney(toBase(total ?? 0, rate), BASE_CURRENCY);
  const today = (type: RateType, now: Stamp): TodayRate => {
    const differs = now.rateType !== locked.rateType || Math.abs(now.exchangeRate - locked.rate) > 1e-9;
    const totals = !withTotal ? "" : differs ? ` · total ${inBase(locked.rate)} → ${inBase(now.exchangeRate)}` : ` · total ${inBase(now.exchangeRate)}`;
    return { line: rateLine(currency, type, now.exchangeRate, `Today, ${formatRateDate(now.rateDate)}`) + totals, differs };
  };
  // Today's corporate rate falls back to mid-market when none is set: then there is no corporate option.
  const corp = todayOf("corporate");
  const corporate = corp.rateType === "corporate" ? today("corporate", corp) : undefined;
  return {
    locked: rateLine(currency, locked.rateType, locked.rate, formatRateDate(locked.rateDate)) + (withTotal ? ` · total ${inBase(locked.rate)}` : ""),
    today: { mid: today("mid", todayOf("mid")), corporate },
    defaultType: locked.rateType === "corporate" && corporate ? "corporate" : "mid",
  };
}

export function VersionRateChoice({
  fromVersion,
  options,
  value,
  onChange,
}: {
  fromVersion: number;
  options: VersionRateOptions;
  value: Choice;
  onChange: (choice: Choice) => void;
}) {
  /* A new version, or a restored one, always takes today's rate (25 Nov
     2026): no "Keep version N's rate" choice. The type stays the version's
     when today has one of that type (a corporate rate set), else mid-market. */
  const todayChoice: Choice = options.defaultType === "corporate" && options.today.corporate ? "current-corporate" : "current-mid";
  React.useEffect(() => {
    if (value !== todayChoice) onChange(todayChoice);
  }, [value, todayChoice]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = (todayChoice === "current-corporate" && options.today.corporate) || options.today.mid;
  return (
    <div className="w-full text-left" style={{ fontFamily: FONT }}>
      <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
        Exchange rate
      </p>
      <p className="text-[11.5px] text-slate-500 mt-0.5">
        Uses today's rate. The customer's amounts don't change; the order's total in {BASE_CURRENCY} follows the rate.
      </p>
      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5" aria-label="Exchange rate for the new version">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] text-slate-800" style={{ fontWeight: 600 }}>
            Today's rate
          </span>
        </span>
        <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5 leading-relaxed">
          {today.differs ? today.line : `${today.line} · same as version ${fromVersion}'s`}
        </span>
      </div>
    </div>
  );
}

/** The options' lines for an order (at the rate the version locked in); null
 *  on a base-currency order. */
export function versionRateOptions(so: SoFxFields, total: number): VersionRateOptions | null {
  const fx = soFx(so);
  if (fx.isBase) return null;
  return buildOptions(fx.currency, fx, (type) => currentRateFor(so, type), total);
}
